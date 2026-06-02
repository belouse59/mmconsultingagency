"use strict";

const { query } = require("../../db");
const crypto = require("crypto");
function mapSimulation(row) {

    if (!row) return null;

    return {
        id: row.id,
        contactId: row.contact_id,
        housingType: row.housing_type,
        location: row.location,
        surface: row.surface,
        energySource: row.energy_source,
        peopleCount: row.people_count,
        provider: row.provider,
        annualBill: row.annual_bill,
        electricityKwh: row.electricity_kwh,
        gasKwh: row.gas_kwh,
        estimatedMonthlySavings:
            row.estimated_monthly_savings,
        createdAt: row.created_at,
    };
}

async function createSimulationRequest({
    contactId,
    housingType,
    location,
    surface,
    energySource,
    peopleCount,
    provider,
    annualBill,
    electricityKwh,
    gasKwh,
    estimatedMonthlySavings,
}) {
    const id =
            `simulator-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const result = await query(
        `
        INSERT INTO simulation_requests (
            id,    
            contact_id,
            housing_type,
            location,
            surface,
            energy_source,
            people_count,
            provider,
            annual_bill,
            electricity_kwh,
            gas_kwh,
            estimated_monthly_savings
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
        RETURNING *
        `,
        [   id,
            contactId,
            housingType,
            location,
            surface,
            energySource,
            peopleCount,
            provider,
            annualBill,
            electricityKwh,
            gasKwh,
            estimatedMonthlySavings,
        ]
    );

    return mapSimulation(
        result.rows[0]
    );
}

async function getSimulations() {

    const result = await query(
        `
        SELECT *
        FROM simulation_requests
        ORDER BY created_at DESC
        `
    );

    return result.rows.map(
        mapSimulation
    );
}

module.exports = {
    createSimulationRequest,
    getSimulations,
};