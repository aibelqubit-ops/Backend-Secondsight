import { describe, expect, it, beforeEach } from "@jest/globals";
import { NetCalculator } from './net_calculator';
import { Circuit, Breadboard, Component, Wire } from './types';

describe('NetCalculator', () => {
  let calculator: NetCalculator;
  let testCircuit: Circuit;

  beforeEach(() => {
    calculator = new NetCalculator();

    // Setup a simple breadboard
    const testBreadboard: Breadboard = {
      id: 'bb-1',
      name: 'Test Board',
      size: 'half',
      columns: 30,
      centerGap: true,
      rowGroups: [
        { id: 'top-abcde', side: 'top', rows: ['a', 'b', 'c', 'd', 'e'] },
        { id: 'bottom-fghij', side: 'bottom', rows: ['f', 'g', 'h', 'i', 'j'] }
      ],
      powerRails: [
        { id: 'rail-top-pos', polarity: 'positive', position: 'top', columnRange: [1, 30] },
        { id: 'rail-top-neg', polarity: 'negative', position: 'top', columnRange: [1, 30] }
      ]
    };

    // Resistor connected across columns 10 and 15
    const resistor: Component = {
      id: 'comp-r1',
      type: 'resistor',
      label: 'R1',
      value: '220ohm',
      packageType: 'axial',
      manufacturer: 'Generic',
      datasheetUrl: '',
      pins: [
        { pinId: 'comp-r1:pin1', pinName: '1', pinFunction: 'signal', insertedAtHoleId: 'bb-1:top-abcde:col10:row-a' },
        { pinId: 'comp-r1:pin2', pinName: '2', pinFunction: 'signal', insertedAtHoleId: 'bb-1:top-abcde:col15:row-a' }
      ]
    };

    // LED connected from column 15 to ground rail
    const led: Component = {
      id: 'comp-led1',
      type: 'led',
      label: 'LED1',
      value: 'Red',
      packageType: '5mm',
      manufacturer: 'Generic',
      datasheetUrl: '',
      pins: [
        { pinId: 'comp-led1:anode', pinName: 'anode', pinFunction: 'signal', insertedAtHoleId: 'bb-1:top-abcde:col15:row-b' },
        { pinId: 'comp-led1:cathode', pinName: 'cathode', pinFunction: 'ground', insertedAtHoleId: 'bb-1:rail-top-neg:col20' }
      ]
    };

    // Wire connecting VCC to the resistor
    const wire: Wire = {
      id: 'wire-1',
      color: 'red',
      gauge: '22AWG',
      endA: { externalRef: 'power-supply-vcc', holeId: null },
      endB: { holeId: 'bb-1:top-abcde:col10:row-e', externalRef: null },
      status: 'connected',
      createdAt: new Date().toISOString(),
      createdBy: 'test'
    };

    // Wire connecting Ground to the rail
    const groundWire: Wire = {
      id: 'wire-2',
      color: 'black',
      gauge: '22AWG',
      endA: { externalRef: 'power-supply-gnd', holeId: null },
      endB: { holeId: 'bb-1:rail-top-neg:col1', externalRef: null },
      status: 'connected',
      createdAt: new Date().toISOString(),
      createdBy: 'test'
    };

    testCircuit = {
      id: 'circuit-test-1',
      name: 'Test Circuit',
      breadboards: [testBreadboard],
      components: [resistor, led],
      wires: [wire, groundWire],
      nets: [],
      powerSupplies: [
        { id: 'ps-1', name: 'Power Supply', terminals: ['power-supply-vcc', 'power-supply-gnd'], voltageSetting: 5 }
      ],
      status: 'design',
      notes: '',
      photos: [],
      snapshotHistory: []
    };
  });

  it('should correctly identify nets in a simple LED circuit', () => {
    const nets = calculator.calculateNets(testCircuit);

    // We expect:
    // 1. A VCC net (power supply VCC -> wire-1 -> col 10 -> R1 pin 1)
    // 2. A SIGNAL net (R1 pin 2 -> col 15 -> LED anode)
    // 3. A GND net (LED cathode -> top neg rail -> wire-2 -> power supply GND)

    // Find the nets
    const vccNet = nets.find(n => n.externalRefs.includes('power-supply-vcc'));
    expect(vccNet).toBeDefined();
    expect(vccNet?.netType).toBe('power');
    expect(vccNet?.memberPinIds).toContain('comp-r1:pin1');
    expect(vccNet?.memberHoleIds).toContain('bb-1:top-abcde:col10:row-e');
    expect(vccNet?.memberHoleIds).toContain('bb-1:top-abcde:col10:row-a');

    const gndNet = nets.find(n => n.externalRefs.includes('power-supply-gnd'));
    expect(gndNet).toBeDefined();
    expect(gndNet?.netType).toBe('ground');
    expect(gndNet?.memberPinIds).toContain('comp-led1:cathode');
    expect(gndNet?.memberHoleIds).toContain('bb-1:rail-top-neg:col1');
    expect(gndNet?.memberHoleIds).toContain('bb-1:rail-top-neg:col20');
    expect(gndNet?.memberHoleIds).toContain('bb-1:rail-top-neg:col30'); // should include the whole rail

    const signalNet = nets.find(n => n.memberPinIds.includes('comp-r1:pin2'));
    expect(signalNet).toBeDefined();
    // In this specific net, it connects R1 pin 2 and LED anode
    expect(signalNet?.memberPinIds).toContain('comp-led1:anode');
    expect(signalNet?.memberHoleIds).toContain('bb-1:top-abcde:col15:row-a');
    expect(signalNet?.memberHoleIds).toContain('bb-1:top-abcde:col15:row-b');
  });
});
