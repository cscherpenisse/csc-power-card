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
        // 🔋 BATTERIJEN
        // =====================
        const batteries = this.config.battery?.list ?? [];
        const batY = houseYCenter - 90;
        const batPositions = [160, 240];

        batteries.forEach((b, i) => {
            const x = batPositions[i] || 200;

            allDonuts += `<g>${this.renderDonutStatic(
                x, batY, "#4caf50", "🔋",
                b.name || `Accu ${i+1}`,
                `bat_${i}`, 25, 9
            )}</g>`;
        });

        // =====================
        // 🔋 BATTERIJ LIJNEN (FIXED)
        // =====================
        const houseX = 200;
        const houseY = houseYCenter;

        const batMidX = batteries.length >= 2
            ? (batPositions[0] + batPositions[1]) / 2
            : batPositions[0];

        // lijn tussen batterijen
        if (batteries.length >= 2) {
            allPaths += `
                <path id="path_bat_link"
                d="M ${batPositions[0]} ${batY}
                   L ${batPositions[1]} ${batY}" />
            `;
            allLinesBg += `<use class="line-bg" href="#path_bat_link" />`;
            allLinesMove += `<use class="line-move" id="move_bat_link" href="#path_bat_link" />`;
        }

        // lijn naar huis (strakke T-splitsing)
        allPaths += `
            <path id="path_bat_huis"
            d="M ${batMidX} ${batY}
               L ${batMidX} ${houseY - 25}
               L ${houseX} ${houseY - 25}
               L ${houseX} ${houseY - 18}" />
        `;
        allLinesBg += `<use class="line-bg" href="#path_bat_huis" />`;
        allLinesMove += `<use class="line-move" id="move_bat_huis" href="#path_bat_huis" />`;

        // =====================
        // ☀️ ZON / HUIS / NET
        // =====================
        allPaths += `<path id="path_zon_huis" d="M 80 ${animStartPos + 25} L 80 ${animStartPos + shiftY} L 175 ${animStartPos + shiftY}" />`;
        allPaths += `<path id="path_huis_net" d="M 225 ${animStartPos + shiftY} L 320 ${animStartPos + shiftY} L 320 ${animStartPos + 25}" />`;

        const totalHeight = animStartPos + 150;

        this.shadowRoot.innerHTML = `
        <style>
            .line-bg { fill:none; stroke:#333; stroke-width:2; }
            .line-move {
                stroke:#fff;
                stroke-width:6;
                stroke-linecap:round;
                stroke-linejoin:round;
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

            <g>${allLinesBg}
                <use class="line-bg" href="#path_zon_huis"/>
                <use class="line-bg" href="#path_huis_net"/>
            </g>

            <g>${allLinesMove}
                <use class="line-move" id="move_zon" href="#path_zon_huis"/>
                <use class="line-move" id="move_net" href="#path_huis_net"/>
            </g>

            <g>${allDonuts}
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

    renderDonutStatic(x, y, color, icon, label, id, iconSize = 14, iconY = 5, radius = 18) {
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

        // 🔋 BATTERIJ FLOW
        let totalBat = 0;

        (this.config.battery?.list ?? []).forEach((b, i) => {
            const power = parseFloat(this._hass.states[b.power]?.state ?? 0);
            const soc = parseFloat(this._hass.states[b.soc]?.state ?? 0);

            totalBat += power;

            const socEl = this.shadowRoot.getElementById(`soc_bat_${i}`);
            if (socEl) socEl.textContent = `${Math.round(soc)}%`;

            const valEl = this.shadowRoot.getElementById(`val_bat_${i}`);
            if (valEl) valEl.textContent = `${Math.round(power)}W`;
        });

        const moveBat = this.shadowRoot.getElementById("move_bat_huis");
        if (moveBat) {
            const abs = Math.abs(totalBat);
            moveBat.style.visibility = abs > 5 ? "visible" : "hidden";
            moveBat.classList.toggle("reverse", totalBat > 0);
        }
    }

    updateEntity(id, val, max) {
        const el = this.shadowRoot.getElementById(`val_${id}`);
        if (el) el.textContent = `${Math.round(val)}W`;
    }
}

customElements.define("csc-power-card", CscPowerCard);
