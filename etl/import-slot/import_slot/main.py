from smart_open import open
import os
import boto3
import csv
import datetime
import traceback

dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("DATA_TABLE")
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    try:
        s3_object = event.get("Records")[0]["s3"]
        s3_file_url = "s3://" + s3_object["bucket"]["name"] + "/" + s3_object["object"]["key"]
        with open(s3_file_url, newline="") as csvfile:
            rows = csv.DictReader(csvfile)

            table = dynamodb.Table(table_name)
            lastUpdate = datetime.datetime.now().isoformat()

            with table.batch_writer() as batch:
                for row in rows:
                    startDatetime = row["Data e ora inizio slot (ISO 8601)"]
                    batch.put_item(
                        Item={
                            "pk": "p-" + row["ID Palestra"],
                            "sk": "s-"
                            + startDatetime
                            + "~"
                            + row["Durata in minuti"],
                            "allowedPeople": int(row["Posti disponibili"]),
                            "startDatetime": startDatetime,
                            "duration": int(row["Durata in minuti"]),
                            "lastUpdate": lastUpdate,
                            "availablePlaces": int(row["Posti disponibili"]),
                        }
                    )
    except Exception as error:
        traceback.print_exc()
        raise error