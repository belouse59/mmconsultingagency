const translations = {
  energyType: {
    Electricity: "Elettricità",
    Gas: "Gas",
    Both: "Luce + Gas",
    both: "Luce + Gas",
    electricity: "Elettricità",
    gas: "Gas",
  },

  selectedEnergy: {
    both: "Luce + Gas",
    electricity: "Elettricità",
    gas: "Gas",
  },

  selectedHouse: {
    flat: "Appartamento",
    house: "Casa",
    villa: "Villa",
  },

  selectedPeople: {
    "1": "1 persona",
    "2": "2 persone",
    "3": "3 persone",
    "4+": "4+ persone",
  },

  estimationType: {
    real: "Stima reale",
    estimated: "Stima stimata",
  },

  formType: {
    contact: "Contatto",
    simulator: "Simulatore",
  },
};

function translateValue(field, value) {
  if (!value) return value;

  return translations[field]?.[value] || value;
}

function translateFormData(data) {
  const translated = { ...data };

  Object.keys(translations).forEach((field) => {
    if (translated[field]) {
      translated[field] = translateValue(field, translated[field]);
    }
  });

  return translated;
}

module.exports = {
  translateFormData,
  translateValue,
};