const fs = require("fs");
const path = require("path");

const getPartnerImages = (req, res) => {
  console.log('HERE')
  const dirPath = path.join(__dirname, "../../public/assets/partners");

  fs.readdir(dirPath, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Cannot read images folder" });
    }

    // filter only images
    const images = files.filter(file =>
      /\.(png|jpg|jpeg|webp|svg)$/i.test(file)
    );

    // map to URLs
    const imageUrls = images.map(file => `/assets/partners/${file}`);

    res.json(imageUrls);
  });
};

module.exports = { getPartnerImages };