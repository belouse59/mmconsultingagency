"use strict";

const simulationRepo =
    require("../../repositories/form/simulatorRepository");

const {
    notifySimulator,
} = require("../../services/emailService");

const {
    clean,
} = require("../../utils/sanitizer");

async function submit(data = {}) {

    const simulation =
        await simulationRepo.createSimulationRequest({

            contactId:
                data.contactId || null,

            housingType:
                clean(data.selectedHouse || ""),

            location:
                clean(data.locationValue || ""),

            surface:
                Math.max(
                    0,
                    Number(data.surface) || 0
                ),

            energySource:
                clean(data.selectedEnergy || ""),

            peopleCount:
                Math.max(
                    0,
                    Number(data.selectedPeople) || 0
                ),

            provider:
                clean(data.selectedProvider || ""),

            annualBill:
                Math.max(
                    0,
                    Number(data.bill) || 0
                ),

            electricityKwh:
                Math.max(
                    0,
                    Number(data.electricityValueKwh) || 0
                ),

            gasKwh:
                Math.max(
                    0,
                    Number(data.gasValueKwh) || 0
                ),

            estimatedMonthlySavings:
                Math.max(
                    0,
                    Number(data.monthlySavings) || 0
                ),
        });

    notifySimulator({
        simulationId: simulation.id,
        ...data,
    }).catch(console.error);

    return {
        success: true,
        message: "Simulazione registrata.",
    };
}

module.exports = {
    submit,
};