openssl ecparam -name prime256v1 -genkey -noout -out ecdsa.key
openssl req -new -x509 -key ecdsa.key -out ecdsa.crt -days 7 -subj "/CN=local.test" -addext "subjectAltName=DNS:local.test" -addext "basicConstraints=CA:FALSE"
openssl x509 -in ecdsa.crt -outform DER | openssl dgst -sha256