import fs from 'fs';
import test from 'tape';
import path from 'path';
import load from 'load-json-file';
import write from 'write-json-file';
import { point } from '@turf/helpers';
import truncate from './index';

const directories = {
    in: path.join(__dirname, 'test', 'in') + path.sep,
    out: path.join(__dirname, 'test', 'out') + path.sep
};

let fixtures = fs.readdirSync(directories.in).map(filename => {
    return {
        filename,
        name: path.parse(filename).name,
        geojson: load.sync(directories.in + filename)
    };
});
// fixtures = fixtures.filter(fixture => fixture.name === 'points');

test('turf-truncate', t => {
    for (const {filename, name, geojson}  of fixtures) {
        const {precision, coordinates} = geojson.properties || {};
        const results = truncate(geojson, precision, coordinates);

        if (process.env.REGEN) write.sync(directories.out + filename, results);
        t.deepEqual(results, load.sync(directories.out + filename), name);
    }
    t.end();
});

test('turf-truncate - precision & coordinates', t => {
    t.deepEqual(truncate(point([50.1234567, 40.1234567]), 3).geometry.coordinates, [50.123, 40.123], 'precision 3');
    t.deepEqual(truncate(point([50.1234567, 40.1234567]), 0).geometry.coordinates, [50, 40], 'precision 0');
    t.deepEqual(truncate(point([50, 40, 1100]), 6).geometry.coordinates, [50, 40, 1100], 'coordinates default to 3');
    t.deepEqual(truncate(point([50, 40, 1100]), 6, 2).geometry.coordinates, [50, 40], 'coordinates 2');
    t.end();
});

test('turf-truncate - prevent input mutation', t => {
    const pt = point([120.123, 40.123, 3000]);
    const ptBefore = JSON.parse(JSON.stringify(pt));

    truncate(pt, 0);
    t.deepEqual(ptBefore, pt, 'does not mutate input');

    truncate(pt, 0, 2, true);
    t.deepEqual(pt, point([120, 40]), 'does mutate input');
    t.end();
});
