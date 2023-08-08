import { Schema, model, Types } from "mongoose";
import User from "./User.js";

const schema = new Schema({
  userId: {
    type: Types.ObjectId,
    ref: User,
    required: true,
  },
  categoryName: {
    type: String,
    required: true,
  },
  categoryImageLink: {
    type: String,
    required: true,
  },
  transactionType: {
    type: Boolean, // True for income and False for expense
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
});

const Transaction = model("Transaction", schema);

export default Transaction;
