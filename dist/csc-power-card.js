class CscPowerCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this._initialized = false;
    }

    setConfig(config) {
        this.config = config;
    }

    set hass(hass) {
        this._hass = hass;
        this.render();
    }

    initialRender() {
        const groups = this.config.solar?.groups ?? [];
        const devices = (this.config.home?.devices ?? []);

        const showBatteries = this.config.battery?.show !== false;
        const batteries = showBatteries ? (this.config.battery?.list ?? []) : [];

        let currentYPos = 15;
        const groupPositions = groups.map(group => {
            const pos = currentYPos;
            const rows = Math.ceil((group.entities || []).length / 4);
            currentYPos += (rows * 70) + 25;
            return pos;
        });

        const flowBoxY = currentYPos + 5;
        const animStartPos = flowBoxY + 75;
        const shiftY = 50;
        const houseYCenter = animStartPos + shiftY;

        let allPaths = '';
        let allLinesBg = '';
        let allLinesMove = '';
        let allDonuts = '';
        let allLabels = '';

        // =====================
        // 🔋 BATTERIJEN + FLOW
        // =====================
        const batY = houseYCenter - 90;
        const batPositions = [160, 240];

        batteries.forEach((b, i) => {
            const x = batPositions[i] || 200;

            // donut
            allDonuts += `<g>${this.renderDonutStatic(
                x, batY, "#4caf50", "🔋", b.name || `Accu ${i+1}`, `bat_${i}`, 25, 9
            )}</g>`;

            // pad batterij ↔ huis
            const pathId = `path_bat_huis_${i}`;
            allPaths += `
                <path id="${pathId}" d="
                    M ${x} ${batY + 20}
                    L ${x} ${houseYCenter - 40}
                    L 200 ${houseYCenter - 40}
                    L 200 ${houseYCenter - 18}
                " />
            `;

            allLinesBg += `<use class="line-bg" href="#${pathId}" />`;
            allLinesMove += `<use class="line-move" id="move_bat_${i}" href="#${pathId}" />`;
        });

        // =====================
        // BESTAANDE CODE (ONAANGEPAST)
        // =====================
        groups.forEach((group, groupIdx) => {
            const inverters = group.entities || [];
            const startYPos = groupPositions[groupIdx];
            const relayY = startYPos + 32;

            const relayPathId = `path_relay_g${groupIdx}`;
            allPaths += `<path id="${relayPathId}" d="M 20 ${relayY} L 5 ${relayY} L 5 ${animStartPos} L 55 ${animStartPos}" />`;
            allLinesBg += `<use class="line-bg" href="#${relayPathId}" />`;
            allLinesMove += `<use class="line-move" id="move_relay_${groupIdx}" href="#${relayPathId}" />`;

            inverters.forEach((item, i) => {
                const col = i % 4;
                const row = Math.floor(i / 4);
                const x = 60 + (col * 93);
                const y = startYPos + 60 + (row * 70);

                const pathId = `path_g${groupIdx}_i${i}`;
                const turnY = (y - 18) - 10;

                allPaths += `<path id="${pathId}" d="M ${x} ${y - 18} L ${x} ${turnY} L 20 ${turnY} L 20 ${relayY}" />`;
                allLinesBg += `<use class="line-bg" href="#${pathId}" />`;
                allLinesMove += `<use class="line-move" id="move_g${groupIdx}_i${i}" href="#${pathId}" />`;

                allDonuts += `<g>${this.renderDonutStatic(x, y, "yellow", "🪩", `P${i + 1}`, `g${groupIdx}_i${i}`, 25, 9)}</g>`;
            });

            allLabels += `<text x="35" y="${relayY - 20}" id="group_val_${groupIdx}" class="static-label"></text>`;
        });

        allPaths += `<path id="path_zon_huis" d="M 80 ${animStartPos + 25} L 80 ${animStartPos + shiftY} L 175 ${animStartPos + shiftY}" />`;
        allPaths += `<path id="path_huis_net" d="M 225 ${animStartPos + shiftY} L 320 ${animStartPos + shiftY} L 320 ${animStartPos + 25}" />`;

        const totalHeight = animStartPos + 150;

        this.shadowRoot.innerHTML = `
        <style>
            .line-bg { stroke:#333; stroke-width:2; fill:none; }
            .line-move {
                stroke:#fff;
                stroke-width:6;
                stroke-dasharray:0.3,100;
                animation:flow 3s linear infinite;
            }
            .line-move.reverse { animation-direction: reverse; }

            @keyframes flow {
                from { stroke-dashoffset:100; }
                to { stroke-dashoffset:0; }
            }
        </style>

        <ha-card>
        <svg viewBox="0 0 800 ${totalHeight}">
            <defs>${allPaths}</defs>

            <g>${allLinesBg}</g>

            <g>
                ${allLinesMove}
                <use class="line-move" id="move_zon" href="#path_zon_huis"/>
                <use class="line-move" id="move_net" href="#path_huis_net"/>
            </g>

            <g>
                ${allDonuts}
                ${this.renderDonutStatic(80, animStartPos, "#ff9800", "☀️", "Zon", "zon")}
                ${this.renderDonutStatic(200, houseYCenter, "#2196f3", "🏠", "Huis", "huis")}
                ${this.renderDonutStatic(320, animStartPos, "#8353d1", "🔌", "Net", "net")}
            </g>

            <g>${allLabels}</g>
        </svg>
        </ha-card>
        `;

        this._initialized = true;
    }

    renderDonutStatic(x, y, color, icon, label, id, iconSize = 14, iconY = 5, radius = 18, fontsize = 14) {
        return `
        <text id="soc_${id}" x="${x}" y="${y - radius - 8}" text-anchor="middle" font-size="12px" fill="#aaa"></text>
        <circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="#444" stroke-width="5"/>
        <circle id="ring_${id}" cx="${x}" cy="${y}" r="${radius}"
            fill="none" stroke="${color}" stroke-width="5"
            stroke-dasharray="113" stroke-dashoffset="113"
            transform="rotate(-90 ${x} ${y})"/>
        <text x="${x}" y="${y+iconY}" text-anchor="middle" font-size="${iconSize}px">${icon}</text>
        <text x="${x+25}" y="${y-4}">${label}</text>
        <text id="val_${id}" x="${x+25}" y="${y+12}">0W</text>
        `;
    }

    render() {
        if (!this._hass || !this.config) return;
        if (!this._initialized) this.initialRender();

        const solar = parseFloat(this._hass.states[this.config.solar?.gateway?.entity]?.state) || 0;
        const grid = parseFloat(this._hass.states[this.config.grid?.entity]?.state) || 0;
        const home = solar + grid;

        this.updateEntity('zon', solar, 5000);
        this.updateEntity('huis', home, 5000);
        this.updateEntity('net', grid, 5000);

        // 🔋 BATTERIJEN
        (this.config.battery?.show !== false ? this.config.battery?.list : []).forEach((b, i) => {
            const power = parseFloat(this._hass.states[b.power]?.state ?? 0);
            const soc = parseFloat(this._hass.states[b.soc]?.state ?? 0);

            const socEl = this.shadowRoot.getElementById(`soc_bat_${i}`);
            if (socEl) socEl.textContent = `${Math.round(soc)}%`;

            const valEl = this.shadowRoot.getElementById(`val_bat_${i}`);
            if (valEl) valEl.textContent = `${Math.round(power)}W`;

            const ringEl = this.shadowRoot.getElementById(`ring_bat_${i}`);
            if (ringEl) {
                const max = 800;
                const absPower = Math.min(Math.abs(power), max);
                const offset = 113 - (absPower / max) * 113;
                ringEl.style.strokeDashoffset = offset;
                ringEl.style.stroke = power >= 0 ? "#9c27b0" : "#4caf50";
            }

            const moveEl = this.shadowRoot.getElementById(`move_bat_${i}`);
            if (moveEl) {
                const abs = Math.abs(power);
                moveEl.style.visibility = abs > 5 ? 'visible' : 'hidden';
                moveEl.classList.toggle('reverse', power > 0);
                moveEl.style.animationDuration = `${Math.max(0.5, 3 - abs / 500)}s`;
            }
        });
    }

    updateEntity(id, val, max) {
        const el = this.shadowRoot.getElementById(`val_${id}`);
        if (el) el.textContent = `${Math.round(val)}W`;
    }
}

customElements.define("csc-power-card", CscPowerCard);
