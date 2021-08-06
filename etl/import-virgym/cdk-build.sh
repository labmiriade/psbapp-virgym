
set -eux

cp -r import_virgym/* /asset-output
pip install -r requirements.txt --target /asset-output
