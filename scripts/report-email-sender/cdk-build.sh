
set -eux

cp -r report_email_sender/* /asset-output
pip install -r report_email_sender/requirements.txt --target /asset-output