import ZarinPal from "zarinpal-node-sdk";

const client = new ZarinPal({ merchantId: 'MID', accessToken: 'TOKEN', sandbox: true });
await client.payments.create();
