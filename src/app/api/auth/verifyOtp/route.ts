import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "../../lib/dbconnection";
import { secretKey } from "../../lib/keys";
import { client, serviceSid } from "../../lib/twilioClient";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const generateToken = (user: any, isGuestUser: boolean = false) => {
  const payload = {
    id: user?._id?.toString(),
    mobileNumber: user?.mobileNumber,
    isGuestUser: isGuestUser,
  };
  console.log("oiuytrdfghjkl", payload);
  let now = new Date();
  let expirationDate = new Date(now.getTime() + 1 * 10000);
  const options = {}
  return jwt.sign(payload, secretKey, options);
};

export async function POST(req, res) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { mobileNumber, otp,password } = await req.json();

    if (!mobileNumber ||  !password) {
      return NextResponse.json(
        { message: "Missing mobile number or otp" },
        { status: 400 }
      );
    }
    console.log(mobileNumber, otp,password);

    // Send OTP using Twilio
    let status = "approved";
    // if (process.env.NODE_ENV !== "development") {
    //   if (mobileNumber !== "9999999999" && mobileNumber !== "9999999991") {
    //     try {
    //       const verificationCheck = await client.verify.v2
    //         .services(serviceSid)
    //         .verificationChecks.create({
    //           code: otp,
    //           to: `+91${mobileNumber}`,
    //         });
    //       console.log(verificationCheck);
    //       if (verificationCheck.status == "approved") {
    //         status = "approved";
    //       } else if (verificationCheck.status == "pending") {
    //         status = "pending";
    //       }
    //     } catch (error) {
    //       console.log(error);
    //       status = "error";
    //     }
    //   }
    // }
    // if(mobileNumber==="9999999999" && otp==="123456"){
    //   status = "approved";
    // }else if(mobileNumber==="9999999991" && otp!=="123456"){
    //   status = "error";
    // }

    // Check if user already exists in the database

    if (status == "approved") {
      const db = await connectDB(req);
      console.log("jhgfghjhgfghjk", db);

      const user = await db.collection("users").findOne({ mobileNumber });
      console.log("us67890-r", user);
      const isGuestUser = mobileNumber === "9999999991";
      const isAdminUser = mobileNumber === "8888888888";

      if (user) {
        // if(user.password==undefined){
        //   return NextResponse.json({ error: "Please set a password" }, { status: 400 });
        // }
        if(password){
          //verify with password
          const isPasswordCorrect = await bcrypt.compare(password, user.password);
          if(!isPasswordCorrect){
            return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
          }
        }

        let token = generateToken(user, isGuestUser);
        console.log("jhgfdsdfiop98765", token);
        let now = new Date();
        let expirationDate = new Date(now.getTime() + 1 * 1000);
        cookies().set("ramnath_pansari_user_token", token, {
          // expires: expirationDate,
          // httpOnly: true,
          // secure: true,
        });
        cookies().set(
          "ramnath_pansari_user_data",
          JSON.stringify({ mobileNumber, userId: user?._id }),
          {
            // expires: expirationDate,
            // httpOnly: true,
            // secure: true,
          }
        );
        //verify with password

        const response = {
          message: "OTP successfully verified",
          userAlreadyRegistered: true,
          userData: { ...user, userAlreadyRegistered: true },
          token: token,
        };
        const newRes = isGuestUser ? { ...response, isGuestUser: true,userData:{...user,name:"Guest User",isGuestUser:true} } : isAdminUser ? { ...response, isAdminUser: true,userData:{...user,name:"Admin User",isAdminUser:true} } : response

        return NextResponse.json(
          newRes,
          { status: 200 }
        );
      } else {
        //use bycrypt to hash the password
        const hash = await bcrypt.hashSync(password, 10);
        console.log("hash",hash);
        const result = await db.collection("users").insertOne({ mobileNumber,password:hash });
        const user = await db.collection("users").findOne({ mobileNumber });

        //create new entry in db
        console.log("34567890-=",result);
        console.log(result.ops);
        const token = generateToken(user,isGuestUser);
        await db.collection("carts").insertOne({
          userId: new ObjectId(user._id),
          items: [],
        });
        const response =  {
          message: "OTP successfully verified",
          userAlreadyRegistered: false,
          userData: { ...user, userAlreadyRegistered: false },
          token: token,
        }
        const newRes = isGuestUser ? { ...response, isGuestUser: true,userData:{...user,name:"Guest User",isGuestUser:true} } : isAdminUser ? { ...response, isAdminUser: true,userData:{...user,name:"Admin User",isAdminUser:true} } : response
        return NextResponse.json(
          newRes,
          { status: 200 }
        );
      }
    } else if (status == "pending") {
      return NextResponse.json(
        {
          //give nice message that otp is wrong
          error: "Incorrect OTP. Please enter the correct code.",
        },
        { status: 400 }
      );
    } else if (status == "error" || status == "") {
      return NextResponse.json(
        { error: "Error from twillio" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
