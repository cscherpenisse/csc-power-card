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
        const batteries = this.config.battery?.list ?? [];

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
        // 🔋 BATTERIJ POSITIES
        // =====================
        const batY = houseYCenter - 90;
        const batStartX = 140;

        batteries.forEach((b, i) => {
            const x = batStartX + (i * 120);

            // donut
            allDonuts += `<g>${this.renderDonutStatic(x, batY, "#4caf50", "🔋", b.name, `bat_${i}`, 20, 6)}</g>`;

            // pad huis ↔ batterij
            const pathId = `path_bat_${i}`;
            const path = `
                M 200 ${houseYCenter - 20}
                L 200 ${batY + 40}
                L ${x} ${batY + 40}
                L ${x} ${batY + 18}
            `;

            allPaths += `<path id="${pathId}" d="${path}" />`;
            allLinesBg += `<use class="line-bg" href="#${pathId}" />`;
            allLinesMove += `<use class="line-move" id="move_bat_${i}" href="#${pathId}" />`;
        });

        // =====================
        // BASIS (ZON / HUIS / NET)
        // =====================
        allPaths += `<path id="path_zon_huis" d="M 80 ${animStartPos + 25} L 80 ${animStartPos + shiftY} L 175 ${animStartPos + shiftY}" />`;
        allPaths += `<path id="path_huis_net" d="M 225 ${animStartPos + shiftY} L 320 ${animStartPos + shiftY} L 320 ${animStartPos + 25}" />`;

        // =====================
        // RENDER
        // =====================
        this.shadowRoot.innerHTML = `
        <style>
            .line-bg { stroke:#333; stroke-width:2; fill:none; }
            .line-move {
                stroke:#00ffcc;
                stroke-width:6;
                stroke-linecap:round;
                stroke-dasharray:0.3,100;
                animation:flow 3s linear infinite;
                filter: drop-shadow(0 0 6px #00ffcc);
            }
            .line-move.reverse { animation-direction: reverse; }

            @keyframes flow {
                from { stroke-dashoffset:100; }
                to { stroke-dashoffset:0; }
            }
        </style>

        <ha-card>
        <svg viewBox="0 0 800 ${houseYCenter + 120}">
            <defs>${allPaths}</defs>

            <g>${allLinesBg}</g>
            <g>${allLinesMove}
                <use class="line-move" id="move_zon" href="#path_zon_huis"/>
                <use class="line-move" id="move_net" href="#path_huis_net"/>
            </g>

            <g>${allDonuts}
                ${this.renderDonutStatic(80, animStartPos, "#ff9800", "☀️", "Zon", "zon")}
                ${this.renderDonutStatic(200, houseYCenter, "#2196f3", "🏠", "Huis", "huis")}
                ${this.renderDonutStatic(320, animStartPos, "#8353d1", "🔌", "Net", "net")}
            </g>
        </svg>
        </ha-card>
        `;

        this._initialized = true;
    }

    renderDonutStatic(x, y, color, icon, label, id) {
        return `
        <circle cx="${x}" cy="${y}" r="18" fill="none" stroke="#444" stroke-width="5"/>
        <circle id="ring_${id}" cx="${x}" cy="${y}" r="18"
            fill="none" stroke="${color}" stroke-width="5"
            stroke-dasharray="113" stroke-dashoffset="113"
            transform="rotate(-90 ${x} ${y})"/>
        <text x="${x}" y="${y+5}" text-anchor="middle">${icon}</text>
        <text x="${x+25}" y="${y-4}">${label}</text>
        <text id="val_${id}" x="${x+25}" y="${y+12}" fill="${color}">0W</text>
        `;
    }

    render() {
        if (!this._hass || !this.config) return;
        if (!this._initialized) this.initialRender();

        const solar = parseFloat(this._hass.states[this.config.solar?.gateway?.entity]?.state ?? 0);
        const grid = parseFloat(this._hass.states[this.config.grid?.entity]?.state ?? 0);

        // =====================
        // 🔋 BATTERIJEN
        // =====================
        (this.config.battery?.list ?? []).forEach((b, i) => {
            const power = parseFloat(this._hass.states[b.power]?.state ?? 0);
            const soc = parseFloat(this._hass.states[b.soc]?.state ?? 0);

            const el = this.shadowRoot.getElementById(`val_bat_${i}`);
            if (el) el.textContent = `${Math.round(power)}W (${Math.round(soc)}%)`;

            const move = this.shadowRoot.getElementById(`move_bat_${i}`);
            if (move) {
                move.style.visibility = Math.abs(power) > 5 ? "visible" : "hidden";
                move.classList.toggle("reverse", power < 0);
            }
        });

        // =====================
        // ZON / NET / HUIS
        // =====================
        this.updateEntity('zon', solar, 5000);
        this.updateEntity('net', grid, 5000);
        this.updateEntity('huis', solar + grid, 5000);

        const moveZon = this.shadowRoot.getElementById('move_zon');
        if (moveZon) moveZon.style.visibility = solar > 5 ? 'visible' : 'hidden';

        const moveNet = this.shadowRoot.getElementById('move_net');
        if (moveNet) {
            moveNet.style.visibility = Math.abs(grid) > 5 ? 'visible' : 'hidden';
            moveNet.classList.toggle('reverse', grid > 0);
        }
    }

    updateEntity(id, val, max) {
        const el = this.shadowRoot.getElementById(`val_${id}`);
        if (el) el.textContent = `${Math.round(val)}W`;
    }
}

customElements.define("csc-power-card", CscPowerCard);
