import twilio from "twilio";

const accountSid = "AC564a53fe3fe497fd23f399c898023cca";
const authToken = "21eeff27b4ea6057a69313b5b5997101";
const client = twilio(accountSid, authToken);
const serviceSid = "VA34620b5e6dc90c505aa750d835b8874f";

export { client, serviceSid };
