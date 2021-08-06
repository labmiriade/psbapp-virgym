from smart_open import open
import os
import boto3
import csv

from typing import List
import traceback

CSV_DATA_URL = "https://dati.veneto.it/SpodCkanApi/api/1/rest/dataset/progetto_avatar_palestre_digitali.csv"

dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("DATA_TABLE")
table = dynamodb.Table(table_name)


def lambda_handler(event, context):
    failed_records: List[str] = []
    ids_from_csv = set()

    with table.batch_writer() as batch:
        with open(CSV_DATA_URL) as csvfile:
            reader = csv.DictReader(csvfile, delimiter=";")
            for row in reader:
                place_id = row["ID_NUMBER"]
                try:
                    batch.put_item(
                        Item={
                            "pk": "p-" + place_id,
                            "sk": "p-info",
                            "data": {
                                "openingTimeDesc": get_or_error(row, "ORARIO"),
                                "website": get_or_error(row, "SITO_WWW"),
                                "placeId": place_id,
                                "city": get_or_error(row, "COMUNE"),
                                "streetNumber": get_or_error(row, "SEDE_CIVIC"),
                                "cpu": "8 core",
                                "lon": get_or_error(row, "Longitudine"),
                                "building": get_or_error(row, "SEDE_PRESS"),
                                "province": get_or_error(row, "SEDE_PROV"),
                                "phone": get_or_error(row, "TELEFONO"),
                                "street": get_or_error(row, "SEDE_VIA"),
                                "name": get_or_error(row, "NOME"),
                                "category": get_or_error(row, "CATEGORIA"),
                                "representative": get_or_error(row, "REFERENTE"),
                                "lat": get_or_error(row, "Latitudine"),
                                "istatCode": get_or_error(row, "COD_ISTAT"),
                                "searchable": True,
                                "bookable": True,
                            },
                            "gsi1pk": "place",
                        }
                    )
                    ids_from_csv.add(place_id)
                except Exception as error:
                    failed_records.append(place_id)
                    print(f"error processing {row=} {error=} {place_id=}")
                    traceback.print_exc()

    if failed_records:
        raise Exception

    place_records = query_places()
    # cerco i record che non esistono nel CSV
    for place_record in place_records:
        id_record = place_record["pk"]["S"].replace("p-", "")
        if id_record not in ids_from_csv:
            update_place(place_record["pk"]["S"], "false", "false")


def get_or_error(item, key):
    try:
        return item[key]
    except KeyError:
        print(f"Missing key: {key}")
    return ""


def query_places():
    dynamoclient = boto3.client("dynamodb")
    query_params = {
        "TableName": table_name,
        "IndexName": "GSI1",
        "ConsistentRead": False,
        "KeyConditionExpression": "gsi1pk = :place",
        "ExpressionAttributeValues": {
            ":place": {"S": "place"},
        },
    }  # query parameters for paginated results

    response = dynamoclient.query(**query_params)
    return response["Items"]


def update_place(pk, bookable, searchable):
    table.update_item(
        Key={"pk": pk, "sk": "p-info"},
        UpdateExpression="SET #data.bookable = :bookable, #data.searchable = :searchable",
        ExpressionAttributeNames={"#data": "data"},
        ExpressionAttributeValues={":bookable": False, ":searchable": False},
    )
