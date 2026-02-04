const Alert = require('../models/alert');
const AlertLog = require('../models/alertLog');
const Event = require('../models/event');
const jsonLogic = require('json-logic-js');
const axios = require('axios');

exports.processCustomerAlerts = async (event, customerId) => {
    try {
        const activeAlerts = await Alert.find({
            customer: customerId,
            isActive: true
        });

        if (!activeAlerts.length) return;

        const dataPool = {
            ...event.payload,
            domain: event.domain,
            action_type: event.action_type,
            deviceId: event.deviceId,
            enrichedData: event.enrichedData
        };

        for (const alert of activeAlerts) {
            let isTriggered = false;
            let currentMetricValue = 0;

            if (alert.type === 'SIMPLE') {
                isTriggered = jsonLogic.apply(alert.logic, dataPool);
                currentMetricValue = event.payload.transaction_amount || 0;
            }
            else if (alert.type === 'AGGREGATE') {
                const { metric, field, windowHours, threshold } = alert.aggregation;
                const lookbackTime = new Date(Date.now() - windowHours * 60 * 60 * 1000);

                const pipeline = [
                    {
                        $match: {
                            business: event.business,
                            'payload.merchant_id': event.payload.merchant_id,
                            createdAt: { $gte: lookbackTime }
                        }
                    }
                ];

                if (metric === 'SUM') {
                    pipeline.push({ $group: { _id: null, resultValue: { $sum: `$payload.${field}` } } });
                } else if (metric === 'COUNT') {
                    pipeline.push({ $group: { _id: null, resultValue: { $sum: 1 } } });
                }

                const stats = await Event.aggregate(pipeline);
                currentMetricValue = stats[0]?.resultValue || 0;
                isTriggered = currentMetricValue >= threshold;
            }

            if (isTriggered) {
                await dispatchNotification(alert, event, currentMetricValue);
            }
        }
    } catch (error) {
        console.error('Critical Error in Alert Watchdog:', error);
    }
};

async function dispatchNotification(alert, event, value) {
    try {
        const { channel, recipient } = alert.settings;
        const merchantName = event.payload.merchant_name || 'Merchant ' + event.payload.merchant_id;

        if (channel === 'SLACK') {
            const message = alert.type === 'AGGREGATE'
                ? `⚠️ *Behavioral Alert: ${alert.name}*\n*Merchant:* ${merchantName}\n*Value:* ${value.toLocaleString()}`
                : `🚨 *Tripwire Hit: ${alert.name}*\n*Merchant:* ${merchantName}`;
            await axios.post(recipient, { text: message });
        }

        await AlertLog.create({
            business: alert.business,
            alert: alert._id,
            customer: alert.customer,
            event: event._id,
            triggerName: alert.name,
            triggerValue: value,
            status: 'DELIVERED'
        });

        alert.lastFired = new Date();
        await alert.save();
    } catch (err) {
        console.error(`Alert Dispatch Error [${alert.name}]:`, err.message);
    }
}