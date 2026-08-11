export interface Breadboard {
  id: string;
  name: string;
  size: 'mini' | 'half' | 'full' | 'full+' | 'custom';
  columns: number;
  rowGroups: {
    id: string;
    rows: string[];
    side: 'top' | 'bottom';
  }[];
  powerRails: {
    id: string;
    polarity: 'positive' | 'negative';
    position: 'top' | 'bottom';
    columnRange: number[];
  }[];
  centerGap: boolean;
}

export interface Hole {
  id: string;
  breadboardId: string;
  column: number;
  row: string;
  stripId: string;
  occupiedBy: {
    kind: 'wire' | 'componentPin' | 'empty';
    refId: string;
  };
}

export interface Component {
  id: string;
  type: 'resistor' | 'capacitor' | 'led' | 'diode' | 'transistor' | 'ic' | 'switch' | 'potentiometer' | 'pushbutton' | 'microcontroller' | 'sensor' | 'relay' | 'motor' | 'battery' | 'other';
  label: string;
  value: string;
  packageType: string;
  manufacturer: string;
  datasheetUrl: string;
  pins: {
    pinId: string;
    pinName: string;
    pinFunction: 'power' | 'ground' | 'signal' | 'io' | 'nc';
    insertedAtHoleId: string | null;
  }[];
}

export interface Wire {
  id: string;
  color: string;
  gauge: string;
  endA: {
    holeId: string | null;
    externalRef: string | null;
  };
  endB: {
    holeId: string | null;
    externalRef: string | null;
  };
  status: 'connected' | 'disconnected' | 'damaged';
  createdAt: string;
  createdBy: string;
}

export interface Net {
  id: string;
  label: string;
  memberHoleIds: string[];
  memberPinIds: string[];
  externalRefs: string[];
  netType: 'power' | 'ground' | 'signal' | 'unknown';
  measuredVoltage: number | null;
}

export interface Circuit {
  id: string;
  name: string;
  breadboards: Breadboard[];
  components: Component[];
  wires: Wire[];
  nets: Net[];
  powerSupplies: {
    id: string;
    name: string;
    terminals: string[];
    voltageSetting: number;
  }[];
  status: 'design' | 'wired' | 'tested' | 'faulty' | 'archived';
  notes: string;
  photos: string[];
  snapshotHistory: {
    versionId: string;
    timestamp: string;
    wiresSnapshot: Wire[];
    componentsSnapshot: Component[];
  }[];
}
