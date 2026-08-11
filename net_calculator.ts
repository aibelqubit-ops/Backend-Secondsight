import { Circuit, Net, Breadboard, Hole, Component, Wire } from './types';

export class NetCalculator {
  public calculateNets(circuit: Circuit): Net[] {
    const graph = new Map<string, Set<string>>();

    const addEdge = (u: string, v: string) => {
      if (!graph.has(u)) graph.set(u, new Set());
      if (!graph.has(v)) graph.set(v, new Set());
      graph.get(u)!.add(v);
      graph.get(v)!.add(u);
    };

    const addNode = (u: string) => {
      if (!graph.has(u)) graph.set(u, new Set());
    };

    // 1. Edges from Breadboards (Holes connected by strips/power rails)
    circuit.breadboards.forEach(board => {
      // Create groups of holes based on row groups and columns
      board.rowGroups.forEach(group => {
        // Group holes by column within each rowGroup
        for (let col = 1; col <= board.columns; col++) {
          const stripHoles = group.rows.map(row => `${board.id}:${group.id}:col${col}:row-${row}`);
          for (let i = 0; i < stripHoles.length; i++) {
            addNode(stripHoles[i] as string);
            for (let j = i + 1; j < stripHoles.length; j++) {
               addEdge(stripHoles[i] as string, stripHoles[j] as string);
            }
          }
        }
      });

      // Power rails
      board.powerRails.forEach(rail => {
        const railHoles = [];
        // Typically rails span across a range of columns
        // Assuming a standard format: bbId:railId:colX
        const startCol = rail.columnRange[0] || 1;
        const endCol = rail.columnRange[1] || board.columns;
        for (let col = startCol; col <= endCol; col++) {
          railHoles.push(`${board.id}:${rail.id}:col${col}`);
        }
        for (let i = 0; i < railHoles.length; i++) {
            addNode(railHoles[i] as string);
            for (let j = i + 1; j < railHoles.length; j++) {
               addEdge(railHoles[i] as string, railHoles[j] as string);
            }
        }
      });
    });

    // Explicitly add any hole in the circuit that might not be generated above but is occupied
    // or just defined somewhere (though usually they should fall into the above).
    // Let's assume breadboard hole definitions above cover everything.

    // 2. Edges from Components (Pins inserted into Holes)
    circuit.components.forEach(component => {
      component.pins.forEach(pin => {
        addNode(pin.pinId);
        if (pin.insertedAtHoleId) {
          addEdge(pin.pinId, pin.insertedAtHoleId);
        }
      });
    });

    // 3. Edges from Wires (Connecting two points)
    circuit.wires.forEach(wire => {
      if (wire.status !== 'connected') return;

      const endANode = wire.endA.holeId || wire.endA.externalRef;
      const endBNode = wire.endB.holeId || wire.endB.externalRef;

      if (endANode) addNode(endANode as string);
      if (endBNode) addNode(endBNode as string);

      if (endANode && endBNode) {
        addEdge(endANode as string, endBNode as string);
      }
    });

    // Run connected components algorithm
    const visited = new Set<string>();
    const nets: Net[] = [];
    let netCounter = 1;

    for (const [node] of graph.entries()) {
      if (!visited.has(node)) {
        const component: string[] = [];
        const queue = [node];
        visited.add(node);

        while (queue.length > 0) {
          const current = queue.shift()!;
          component.push(current);

          for (const neighbor of (graph.get(current) || [])) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }

        // Categorize nodes in the component
        const memberHoleIds: string[] = [];
        const memberPinIds: string[] = [];
        const externalRefs: string[] = [];

        let netType: Net['netType'] = 'unknown';

        component.forEach(n => {
          if (n.startsWith('comp-')) {
            memberPinIds.push(n);
            // Heuristic for net type based on pin function
            circuit.components.forEach(c => {
                const pin = c.pins.find(p => p.pinId === n);
                if (pin) {
                    if (pin.pinFunction === 'power') netType = 'power';
                    else if (pin.pinFunction === 'ground') netType = 'ground';
                    else if (pin.pinFunction === 'signal' && (netType as string) === "unknown") netType = 'signal';
                }
            })
          } else if (n.startsWith('bb-')) {
            memberHoleIds.push(n);
          } else {
            externalRefs.push(n);
             // Heuristic for net type based on external refs (e.g. power supply)
            circuit.powerSupplies?.forEach(ps => {
               if (ps.terminals.includes(n)) {
                   if (n.toLowerCase().includes('gnd') || n.toLowerCase().includes('neg')) netType = 'ground';
                   else if (n.toLowerCase().includes('vcc') || n.toLowerCase().includes('pos')) netType = 'power';
               }
            });
          }
        });

        // Only create a net if there's more than one point connected, or it's a meaningful node
        // Actually, a net could just be a single pin/hole if isolated, but usually we care about sets of connected nodes.
        // Let's create nets for all components that have at least 1 member.

        // Let's filter out isolated empty holes on the breadboard to avoid thousands of empty nets.
        const isSignificant = memberPinIds.length > 0 || externalRefs.length > 0 || (memberHoleIds.length > 5); // more than 5 means connected to something else or wire

        if (component.length > 1 || memberPinIds.length > 0 || externalRefs.length > 0) {

            let label = `Net_${netCounter}`;
            if ((netType as string) === "power") label = "VCC";
            if ((netType as string) === "ground") label = "GND";

            nets.push({
                id: `net-${netCounter.toString().padStart(3, '0')}`,
                label: label,
                memberHoleIds,
                memberPinIds,
                externalRefs,
                netType,
                measuredVoltage: null
            });
            netCounter++;
        }
      }
    }

    // Refine net type classification based on members if it's still unknown
    nets.forEach(net => {
        if ((net.netType as string) === "unknown") {
            if (net.externalRefs.some(ref => ref.toLowerCase().includes('vcc') || ref.toLowerCase().includes('pos') || ref.toLowerCase().includes('+'))) {
                net.netType = 'power';
            } else if (net.externalRefs.some(ref => ref.toLowerCase().includes('gnd') || ref.toLowerCase().includes('neg') || ref.toLowerCase().includes('-'))) {
                net.netType = 'ground';
            } else if (net.memberPinIds.length > 0) {
                net.netType = 'signal';
            }
        }

        if (net.label.startsWith('Net_')) {
            if ((net.netType as string) === "power") net.label = 'VCC';
            if ((net.netType as string) === "ground") net.label = 'GND';
            else if ((net.netType as string) === "signal") net.label = `SIG_${net.id.split('-')[1]}`;
        }
    });

    return nets;
  }
}
