import mongoose from "mongoose";

async function connectServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI).then(() => {
      console.log("Connected to MongoDB");
    });
  } catch (error) {
    console.log(error.message);
  }
}

export default connectServer;
