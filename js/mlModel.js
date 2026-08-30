window.mlModel = (() => {
    const featureNames = [
        "delay",
        "speed",
        "distanceRemaining",
        "trackOccupancy",
        "priorityScore",
        "weatherRisk",
        "hour"
    ];

    const priorityScores = { HIGH: 1, MEDIUM: 0.6, LOW: 0.25 };
    const syntheticRecords = [
        { delay: 0, speed: 94, distanceRemaining: 34, trackOccupancy: 0.2, priorityScore: 1, weatherRisk: 0, hour: 8, targetDelay: 2, conflict: 0 },
        { delay: 4, speed: 78, distanceRemaining: 26, trackOccupancy: 0.4, priorityScore: 1, weatherRisk: 1, hour: 10, targetDelay: 7, conflict: 0 },
        { delay: 9, speed: 70, distanceRemaining: 19, trackOccupancy: 0.7, priorityScore: 1, weatherRisk: 1, hour: 10, targetDelay: 13, conflict: 1 },
        { delay: 13, speed: 54, distanceRemaining: 12, trackOccupancy: 0.9, priorityScore: 1, weatherRisk: 2, hour: 18, targetDelay: 21, conflict: 1 },
        { delay: 2, speed: 46, distanceRemaining: 18, trackOccupancy: 0.6, priorityScore: 0.25, weatherRisk: 0, hour: 10, targetDelay: 8, conflict: 1 },
        { delay: 5, speed: 42, distanceRemaining: 31, trackOccupancy: 0.3, priorityScore: 0.25, weatherRisk: 1, hour: 12, targetDelay: 9, conflict: 0 },
        { delay: 1, speed: 82, distanceRemaining: 40, trackOccupancy: 0.2, priorityScore: 0.6, weatherRisk: 0, hour: 7, targetDelay: 3, conflict: 0 },
        { delay: 7, speed: 62, distanceRemaining: 23, trackOccupancy: 0.7, priorityScore: 0.6, weatherRisk: 2, hour: 17, targetDelay: 15, conflict: 1 },
        { delay: 3, speed: 76, distanceRemaining: 15, trackOccupancy: 0.5, priorityScore: 1, weatherRisk: 0, hour: 14, targetDelay: 6, conflict: 0 },
        { delay: 11, speed: 49, distanceRemaining: 10, trackOccupancy: 0.85, priorityScore: 0.25, weatherRisk: 2, hour: 19, targetDelay: 24, conflict: 1 },
        { delay: 6, speed: 58, distanceRemaining: 29, trackOccupancy: 0.5, priorityScore: 0.6, weatherRisk: 1, hour: 16, targetDelay: 11, conflict: 0 },
        { delay: 0, speed: 88, distanceRemaining: 22, trackOccupancy: 0.1, priorityScore: 1, weatherRisk: 0, hour: 6, targetDelay: 1, conflict: 0 }
    ];

    let records = [...syntheticRecords];
    let dataSource = "Synthetic prototype data";
    let featureRanges = {};

    function rebuildRanges() {
        featureRanges = featureNames.reduce((ranges, name) => {
            const values = records.map(record => Number(record[name]) || 0);
            ranges[name] = {
                min: Math.min(...values),
                max: Math.max(...values)
            };
            return ranges;
        }, {});
    }

    function normalize(record, name) {
        const range = featureRanges[name];
        const value = Number(record[name]) || 0;
        if (!range || range.max === range.min) return 0;
        return (value - range.min) / (range.max - range.min);
    }

    function distance(left, right) {
        return Math.sqrt(featureNames.reduce((sum, name) => {
            const difference = normalize(left, name) - normalize(right, name);
            return sum + difference * difference;
        }, 0));
    }

    function nearestNeighbors(input, count = 5) {
        return records
            .map(record => ({ record, distance: distance(input, record) }))
            .sort((left, right) => left.distance - right.distance)
            .slice(0, count);
    }

    function toFeatureRecord(train, context = {}) {
        return {
            delay: Number(train.delay) || 0,
            speed: Number(train.speed) || 0,
            distanceRemaining: Number(context.distanceRemaining) || 20,
            trackOccupancy: Number(context.trackOccupancy) || 0.6,
            priorityScore: priorityScores[train.priority] || 0.6,
            weatherRisk: Number(context.weatherRisk) || 0,
            hour: Number(context.hour) || new Date().getHours()
        };
    }

    function predictTrain(train, context = {}) {
        const input = toFeatureRecord(train, context);
        const neighbors = nearestNeighbors(input);
        const weightedTotal = neighbors.reduce((sum, neighbor) => {
            const weight = 1 / Math.max(neighbor.distance, 0.05);
            return sum + neighbor.record.targetDelay * weight;
        }, 0);
        const totalWeight = neighbors.reduce((sum, neighbor) => sum + 1 / Math.max(neighbor.distance, 0.05), 0);
        const predictedDelay = Math.max(0, Math.round(weightedTotal / totalWeight));
        const confidence = Math.min(0.97, Math.max(0.52, 1 - neighbors[0].distance / 2));
        return {
            predictedDelay,
            confidence: Math.round(confidence * 100) / 100,
            nearestSamples: neighbors.length,
            source: dataSource
        };
    }

    function predictConflict(firstTrain, secondTrain, context = {}) {
        const first = toFeatureRecord(firstTrain, context);
        const second = toFeatureRecord(secondTrain, context);
        const input = {
            ...first,
            delay: (first.delay + second.delay) / 2,
            speed: first.speed + second.speed,
            distanceRemaining: Number(context.distanceBetween) || 12,
            trackOccupancy: Math.max(first.trackOccupancy, Number(context.trackOccupancy) || 0.6),
            priorityScore: Math.min(first.priorityScore, second.priorityScore)
        };
        const neighbors = nearestNeighbors(input);
        const probability = neighbors.reduce((sum, neighbor) => {
            const weight = 1 / Math.max(neighbor.distance, 0.05);
            return sum + neighbor.record.conflict * weight;
        }, 0) / neighbors.reduce((sum, neighbor) => sum + 1 / Math.max(neighbor.distance, 0.05), 0);
        return {
            probability: Math.round(Math.min(0.99, Math.max(0.01, probability)) * 100) / 100,
            confidence: Math.round(Math.min(0.95, 0.55 + neighbors.length * 0.06) * 100) / 100,
            source: `${dataSource} · nearest-neighbor risk model`
        };
    }

    function train(newRecords) {
        if (!Array.isArray(newRecords) || newRecords.length < 5) {
            return { ok: false, reason: "At least five normalized records are required" };
        }
        const validRecords = newRecords.filter(record => featureNames.every(name => Number.isFinite(Number(record[name]))));
        if (validRecords.length < 5) {
            return { ok: false, reason: "Records are missing required numeric features" };
        }
        records = validRecords;
        dataSource = "Imported historical data";
        rebuildRanges();
        return { ok: true, records: records.length };
    }

    rebuildRanges();

    return {
        version: "prototype-knn-1.0",
        predictTrain,
        predictConflict,
        train,
        getStatus: () => ({ records: records.length, features: featureNames.length, source: dataSource })
    };
})();