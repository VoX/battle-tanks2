// Import required modules from pkijs and related libraries
import * as pkijs from "npm:pkijs";
import * as asn1js from "npm:asn1js";

// Initialize the PKIjs engine with the WebCrypto API
pkijs.setEngine(
  "Deno",
  new pkijs.CryptoEngine({ name: "Deno", crypto }),
);

/**
 * Generates an ECDSA certificate for localhost, similar to:
 *
 * openssl ecparam -name prime256v1 -genkey -noout -out ecdsa.key
 * openssl req -new -x509 -key ecdsa.key -out ecdsa.crt -days 14 -subj "/CN=localhost"
 *   -addext "subjectAltName=DNS:localhost" -addext "basicConstraints=CA:FALSE"
 *
 * @returns {Promise<{cert: string, key: string, fingerprint: string}>}
 *   The certificate and private key as PEM strings, with the SHA-256 fingerprint
 */
export async function generateCert(): Promise<{
  cert: string;
  key: string;
  fingerprint: string;
}> {
  // Generate ECDSA key pair (prime256v1 curve)
  const algorithm = {
    name: "ECDSA",
    namedCurve: "P-256", // prime256v1 is P-256 in Web Crypto API
    hash: {
      name: "SHA-256",
    },
  };

  const keys = await crypto.subtle.generateKey(algorithm, true, [
    "sign",
    "verify",
  ]);

  // Create a new Certificate object
  const certificate = new pkijs.Certificate();

  // Set certificate version
  certificate.version = 2; // X.509 v3 (0-based indexing)

  // Generate random serial number
  const serialNumber = new Uint8Array(8);
  crypto.getRandomValues(serialNumber);
  certificate.serialNumber = new asn1js.Integer({
    valueHex: serialNumber,
  });

  // Set validity period (14 days)
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setDate(notAfter.getDate() + 14); // 14 days validity
  certificate.notBefore.value = notBefore;
  certificate.notAfter.value = notAfter;

  // Create subject and issuer names (CN=localhost)
  const commonName = new pkijs.AttributeTypeAndValue({
    type: "2.5.4.3", // Common Name
    value: new asn1js.PrintableString({ value: "localhost" }),
  });

  certificate.subject.typesAndValues.push(commonName);
  certificate.issuer.typesAndValues.push(commonName);

  // Set public key by creating a PublicKeyInfo object
  const publicKeyInfo = new pkijs.PublicKeyInfo();
  // Convert WebCrypto key to pkijs format
  await publicKeyInfo.importKey(keys.publicKey);
  certificate.subjectPublicKeyInfo = publicKeyInfo;

  // Create and add extensions

  // 1. Basic Constraints (CA:FALSE)
  const basicConstraints = new pkijs.BasicConstraints({
    cA: false,
  });

  certificate.extensions = [];
  certificate.extensions.push(
    new pkijs.Extension({
      extnID: "2.5.29.19", // BasicConstraints OID
      critical: true,
      extnValue: basicConstraints.toSchema().toBER(false),
      parsedValue: basicConstraints,
    }),
  );

  // 2. Subject Alternative Name (DNS:localhost)
  const altNames = new pkijs.GeneralNames({
    names: [
      new pkijs.GeneralName({
        type: 2, // dNSName
        value: "localhost",
      }),
    ],
  });

  certificate.extensions.push(
    new pkijs.Extension({
      extnID: "2.5.29.17", // SubjectAltName OID
      critical: false,
      extnValue: altNames.toSchema().toBER(false),
      parsedValue: altNames,
    }),
  );

  // Self-sign the certificate
  await certificate.sign(keys.privateKey, "SHA-256");

  // Export the certificate to DER format
  const certDer = certificate.toSchema().toBER(false);
  const certDerBytes = new Uint8Array(certDer);

  // Export the private key directly using WebCrypto exportKey
  const privateKeyRaw = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
  const privateKeyDerBytes = new Uint8Array(privateKeyRaw);

  // Convert DER to PEM format
  const certPem = `-----BEGIN CERTIFICATE-----\n${
    btoa(String.fromCharCode(...certDerBytes)).match(/.{1,64}/g)?.join("\n")
  }\n-----END CERTIFICATE-----`;
  const keyPem = `-----BEGIN PRIVATE KEY-----\n${
    btoa(String.fromCharCode(...privateKeyDerBytes)).match(/.{1,64}/g)?.join(
      "\n",
    )
  }\n-----END PRIVATE KEY-----`;

  // Calculate the SHA-256 fingerprint of the certificate
  const certHash = await crypto.subtle.digest("SHA-256", certDerBytes);
  const fingerprint = Array.from(new Uint8Array(certHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    cert: certPem,
    key: keyPem,
    fingerprint,
  };
}
