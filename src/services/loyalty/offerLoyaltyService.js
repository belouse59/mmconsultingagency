"use strict"

const offerRepo = require("../../repositories/offersRepository");

async function getOffers() {
    let offers = await offerRepo.getActiveOffers();
    const rows = offers.rows;
    if (!rows.length) return null;
    return rows.map(row=>{

        const {title, ...rest} = row
        const titleCleaned = title.replace("'", "");
        return {title: titleCleaned, ...rest}
    });
}

async function getActiveOffers() {
    let offers = await offerRepo.getActiveOffers();
    const rows = offers.rows;
    if (!rows.length) return null;
    return rows.map(row=>{

        const {title, ...rest} = row
        const titleCleaned = title.replace("'", "");
        return {title: titleCleaned, ...rest}
    });

}

async function getPartnerOffers(partnerId) {
    let partnerOffers = await offerRepo.getPartnerOffers(partnerId)
    return partnerOffers;
}

async function createOffer(offer){
    let result = offerRepo.createOffer(offer)
    if (result) return result;
}

module.exports = { getOffers, getActiveOffers, getPartnerOffers, createOffer }