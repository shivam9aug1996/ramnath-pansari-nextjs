import assert from "node:assert/strict";

import {
  isReservedLoginMobile,
  normalizeMobileNumber,
} from "../smsOtpUtils";
import {
  ADMIN_MOBILE_FALLBACK,
  DRIVER_MOBILE_FALLBACK,
  GUEST_MOBILE,
} from "@/app/api/admin/users/userUtils";

assert.equal(normalizeMobileNumber("9634396572"), "9634396572");
assert.equal(normalizeMobileNumber("96343 96572"), "9634396572");
assert.equal(normalizeMobileNumber("+91 9634396572"), "9634396572");
assert.equal(normalizeMobileNumber("919634396572"), "9634396572");
assert.equal(normalizeMobileNumber("09634396572"), "9634396572");
assert.equal(normalizeMobileNumber("12345"), null);
assert.equal(normalizeMobileNumber("5634396572"), null);

assert.equal(isReservedLoginMobile(ADMIN_MOBILE_FALLBACK), true);
assert.equal(isReservedLoginMobile(DRIVER_MOBILE_FALLBACK), true);
assert.equal(isReservedLoginMobile(GUEST_MOBILE), true);
assert.equal(isReservedLoginMobile("9634396572"), false);

console.log("smsOtpUtils normalize/reserved ok");
