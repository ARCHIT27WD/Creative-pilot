import express from "express";
import fileUpload from "express-fileupload";
import fetch from "node-fetch";
import FormData from "form-data";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(fileUpload());
app.use(cors());

app.post("/remove-bg", async (req, res) => {
  try {
    const file = req.files?.image;

    if (!file) {
      return res.status(400).send("No file uploaded");
    }

    const apiKey = process.env.REMOVE_BG_KEY;

    const formData = new FormData();
    formData.append("image_file", file.data, file.name);
    formData.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: formData,
    });

    const buffer = await response.arrayBuffer();

    res.set("Content-Type", "image/png");
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing background");
  }
});

app.listen(8080, () => {
  console.log("Background remove server running on http://localhost:8080");
});
