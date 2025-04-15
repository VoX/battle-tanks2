# Just an example showing how to generate a valid pinned Webtransport cert.
# Webtransport requires that it be ecdsa and expire in less than 14 days.
openssl ecparam -name prime256v1 -genkey -noout -out ecdsa.key
openssl req -new -x509 -key ecdsa.key -out ecdsa.crt -days 14 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost" -addext "basicConstraints=CA:FALSE"
openssl x509 -in ecdsa.crt -outform DER | openssl dgst -sha256