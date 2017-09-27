import fs from 'fs';
import test from 'tape';
import path from 'path';
import load from 'load-json-file';
import write from 'write-json-file';
import centroid from '@turf/centroid';
import * as chromatism from 'chromatism';
import concaveman from 'concaveman';
import { point, polygon, featureCollection } from '@turf/helpers';
import { clusterReduce, clusterEach } from '@turf/clusters';
import { coordAll, featureEach } from '@turf/meta';
import clustersKmeans from '.';

const directories = {
    in: path.join(__dirname, 'test', 'in') + path.sep,
    out: path.join(__dirname, 'test', 'out') + path.sep
};

const fixtures = fs.readdirSync(directories.in).map(filename => {
    return {
        filename,
        name: path.parse(filename).name,
        geojson: load.sync(directories.in + filename)
    };
});

test('clusters-kmeans', t => {
    fixtures.forEach(fixture => {
        const name = fixture.name;
        const geojson = fixture.geojson;
        const numberOfCentroids = (geojson.properties || {}).numberOfCentroids;

        const clustered = clustersKmeans(geojson, numberOfCentroids);
        const result = styleResult(clustered);

        if (process.env.REGEN) write.sync(directories.out + name + '.geojson', result);
        t.deepEqual(result, load.sync(directories.out + name + '.geojson'), name);
    });

    t.end();
});

const points = featureCollection([
    point([0, 0], {foo: 'bar'}),
    point([2, 4], {foo: 'bar'}),
    point([3, 6], {foo: 'bar'})
]);

test('clusters-kmeans -- prevent input mutation', t => {
    const before = JSON.parse(JSON.stringify(points));
    clustersKmeans(points);
    t.deepEqual(before, points);
    t.end();
});

test('clusters-kmeans -- throws', t => {
    const poly = polygon([[[0, 0], [10, 10], [0, 10], [0, 0]]]);
    t.throws(() => clustersKmeans(poly, 1), /Input must contain Points/);
    // t.throws(() => clustersKmeans(points, 5), /numberOfClusters can't be greater than the number of points/);
    t.end();
});

test('clusters-kmeans -- translate properties', t => {
    t.equal(clustersKmeans(points, 2).features[0].properties.foo, 'bar');
    t.end();
});

// style result
function styleResult(clustered) {
    const count = clusterReduce(clustered, 'cluster', i => i + 1, 0);
    const colours = chromatism.adjacent(360 / count, count, '#0000FF').hex;
    const features = [];

    // Add all Point
    featureEach(clustered, function (pt) {
        const clusterId = pt.properties.cluster;
        pt.properties['marker-color'] = colours[clusterId];
        pt.properties['marker-size'] = 'small';
        features.push(pt);
    });

    // Iterate over each Cluster
    clusterEach(clustered, 'cluster', (cluster, clusterValue, clusterId) => {
        const color = chromatism.brightness(-25, colours[clusterId]).hex;

        // Add Centroid
        features.push(centroid(cluster, {
            'marker-color': color,
            'marker-symbol': 'star-stroked',
            'marker-size': 'large'
        }));

        // Add concave polygon
        features.push(polygon([concaveman(coordAll(cluster))], {
            fill: color,
            stroke: color,
            'fill-opacity': 0.3
        }));
    });
    return featureCollection(features);
}
