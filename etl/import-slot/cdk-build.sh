
set -eux

cp -r import_slot/* /asset-output
pip install -r requirements.txt --target /asset-output
