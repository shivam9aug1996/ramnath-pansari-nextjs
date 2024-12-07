import twilio from "twilio";

const accountSid = "AC564a53fe3fe497fd23f399c898023cca";
const authToken = "d18d97253fab9ca973cb97514c3cb39a";
const client = twilio(accountSid, authToken);
const serviceSid = "VA34620b5e6dc90c505aa750d835b8874f";

export { client, serviceSid };
