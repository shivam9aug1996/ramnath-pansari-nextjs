import twilio from "twilio";

const accountSid = "AC564a53fe3fe497fd23f399c898023cca";
const authToken = "8fbbeedc5d2d356473c8b0db65e72497";
const client = twilio(accountSid, authToken);
const serviceSid = "VA34620b5e6dc90c505aa750d835b8874f";

export { client, serviceSid };
