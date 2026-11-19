// FAKE data for building the screens (build plan step 1). Replaced by the server in step 2.
import { addDays, todayIso } from '@/lib/dates';
import type { Item } from '@/types';

const clients = [
  { name: 'Ann Lee', address: '5 Oak St, Boca Raton' },
  { name: 'Ben Cruz', address: '12 Palm Dr, Delray Beach' },
  { name: 'Carla Diaz', address: '88 Coral Ave, Boynton Beach' },
  { name: 'David Kim', address: '301 Seabreeze Ln, Boca Raton' },
  { name: 'Elena Petrova', address: '47 Banyan Cir, Lake Worth' },
];

const work = [
  'Installed 3 doors',
  'Fix gate latch',
  'Replace kitchen faucet',
  'Mount TV, hide cables',
  'Patch & paint drywall',
  'Deck repair',
  'Install ceiling fan',
  'Re-caulk shower',
];

let n = 0;
function item(dayOffset: number, fields: Partial<Item>): Item {
  n += 1;
  const c = clients[n % clients.length];
  return {
    id: `fake-${n}`,
    kind: 'task',
    status: 'created',
    date: addDays(todayIso(), dayOffset),
    clientName: c.name,
    address: c.address,
    title: work[n % work.length],
    ...fields,
  };
}

export function fakeItems(): Item[] {
  n = 0;
  return [
    item(-24, { kind: 'invoice', status: 'paid', number: 'INV-0004', amount: 640 }),
    item(-20, { kind: 'invoice', status: 'paid', number: 'INV-0005', amount: 1250 }),
    item(-16, { kind: 'invoice', status: 'requested', number: 'INV-0006', amount: 450 }),
    item(-12, { kind: 'task', status: 'done', time: '09:00' }),
    item(-9, { kind: 'invoice', status: 'paid', number: 'INV-0007', amount: 380 }),
    item(-6, { kind: 'invoice', status: 'requested', number: 'INV-0008', amount: 700 }),
    item(-6, { kind: 'task', status: 'done', time: '14:00' }),
    item(-3, { kind: 'estimate', status: 'sent', number: 'EST-0003', amount: 1800 }),
    item(-1, { kind: 'invoice', status: 'created', number: 'INV-0009', amount: 520 }),
    item(0, { kind: 'invoice', status: 'requested', number: 'INV-0010', amount: 764.5 }),
    item(0, { kind: 'task', status: 'created', time: '14:00' }),
    item(0, { kind: 'estimate', status: 'created', number: 'EST-0004', amount: 2300 }),
    item(0, { kind: 'task', status: 'created', time: '16:30', clientName: undefined, address: undefined, title: 'Pick up tile at Home Depot' }),
    item(1, { kind: 'task', status: 'created', time: '10:00' }),
    item(2, { kind: 'task', status: 'created', time: '08:30' }),
    item(2, { kind: 'task', status: 'created', time: '13:00' }),
    item(5, { kind: 'estimate', status: 'created', number: 'EST-0005', amount: 950 }),
    item(8, { kind: 'task', status: 'created', time: '11:00' }),
    item(13, { kind: 'task', status: 'created', time: '09:30' }),
    item(21, { kind: 'task', status: 'created', time: '15:00' }),
  ];
}
