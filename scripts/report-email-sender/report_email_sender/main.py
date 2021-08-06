import os
import boto3
from boto3.dynamodb.conditions import Attr, Key
from boto3.dynamodb.types import TypeDeserializer
from datetime import datetime, timedelta
from pytz import timezone
from iso8601 import parse_date

sender = os.environ.get("SENDER_EMAIL")
table_name = os.environ.get("DATA_TABLE")

dynamodb = boto3.resource("dynamodb")
dynamo_table = dynamodb.Table(table_name)
mail_client = boto3.client("ses")

deserializer = TypeDeserializer()
# trick to read numbers as float or int (opposed to decimals)
deserializer._deserialize_n = lambda value: float(value) if "." in value else int(value)


def lambda_handler(event, context):
    gyms = dynamo_table.query(
        TableName=table_name,
        IndexName="GSI1",
        KeyConditionExpression=Key("gsi1pk").eq("place"),
        FilterExpression=Attr("data.bookable").eq(True)
        & Attr("data.representative").ne(""),
    )["Items"]
    mailCount = 0

    now = parse_date(
        datetime.utcnow().replace(minute=0, second=0, microsecond=0).isoformat() + "Z"
    )  # creates datetime object for now
    tomorrow = parse_date(
        (datetime.utcnow() + timedelta(days=1))
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .isoformat()
        + "Z"
    )  # create datetime for tomorrow at 00:00

    for gym in gyms:

        booking_sk_yesterday = "b-" + (now - timedelta(days=1)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )  # formato sk: b-{dataslot}-{durata}-{codice-prenotazione}
        booking_sk_tomorrow = "b-" + tomorrow.strftime("%Y-%m-%dT%H:%M:%SZ")

        bookings = dynamo_table.query(
            TableName=table_name,
            KeyConditionExpression=Key("pk").eq(gym["pk"])
            & Key("sk").between(booking_sk_yesterday, booking_sk_tomorrow),
        )[
            "Items"
        ]  # fetches all current gym's bookings between yesterday and tomorrow

        slot_sk_yesterday = booking_sk_yesterday.replace(
            "b", "s", 1
        )  # formato sk: b-{dataslot}-{durata}
        slot_sk_tomorrow = booking_sk_tomorrow.replace("b", "s", 1)

        slots = dynamo_table.query(
            TableName=table_name,
            KeyConditionExpression=Key("pk").eq(gym["pk"])
            & Key("sk").between(slot_sk_yesterday, slot_sk_tomorrow),
        )[
            "Items"
        ]  # fetches all gym's slots that start between yesterday and tomorrow

        slots_description = ""

        for slot in slots:
            slot_bookings = [
                booking
                for booking in bookings
                if booking["sk"].startswith(slot["sk"].replace("s", "b", 1))
            ]
            slot_start = parse_date(slot["startDatetime"])
            slot_end = (
                parse_date(slot["startDatetime"])
                + timedelta(minutes=int(slot["duration"]))
            ).replace(second=0, microsecond=0)
            if (
                slot_end > now and slot_start < tomorrow
            ):  # filters slots, keeps the ones starting before tomorrow and ending after now
                slot_start_local = slot_start.astimezone(
                    timezone("Europe/Rome")
                )  # converts date to local time
                slots_description += "Slot delle " + slot_start_local.strftime("%H:%M")
                if slot["allowedPeople"] == slot["availablePlaces"]:
                    slots_description += ": Nessuna prenotazione<br>"
                else:
                    slots_description += (
                        ": Posti disponibili: "
                        + str(slot["availablePlaces"])
                        + ", Posti prenotati: "
                        + str(slot["allowedPeople"] - slot["availablePlaces"])
                        + "<br>"
                        + "I codici prenotazione sono i seguenti:"
                    )
                    for booking in slot_bookings:
                        slots_description += "<br>" + booking["secretCode"]
                    slots_description += "<br>"

        if slots_description != "":

            slots_description = (
                "L'occupazione di oggi è:<br>"
                + slots_description
                + "<br>Buona giornata"
            )
            mailCount = mailCount + 1
            mail_client.send_email(
                Source=sender,
                Destination={
                    "ToAddresses": [
                        gym["data"]["representative"],
                    ]
                },
                Message={
                    "Subject": {
                        "Data": "Report slots palestra digitale " + gym["data"]["name"],
                    },
                    "Body": {
                        "Text": {
                            "Data": slots_description.replace("<br>", "\n"),
                        },
                        "Html": {
                            "Data": slots_description,
                        },
                    },
                },
                ReplyToAddresses=[
                    sender,
                ],
            )

    return {"message": "sent " + str(mailCount) + " emails"}
