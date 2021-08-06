# Search Lambda

This function is used to perform a search on ElasticSearch based on a query parameter sorting the hits by distance from the 'near' parameter.

This function recieves an event with a 'queryStringParameters' object, optionally containing the query string 'q' and the geopoint 'near' (',)from which the results are sorted.
