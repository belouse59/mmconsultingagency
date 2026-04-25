const fs = require("fs");
const path = require("path");

const getProviders = (req, res) => {
  const dir = path.join(__dirname, "../../public/assets/sim-providers");

  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).json({ error: "Cannot read folder" });

    const providers = files
      .filter(f => /\.(png|jpg|jpeg|webp|svg)$/i.test(f))
      .map(file => {
        const key = file.split(".")[0];

        return {
          key,
          name: key.toUpperCase(),
          image: `/assets/sim-providers/${file}`
        };
      });

    res.json(providers);
  });
};

module.exports = { getProviders };