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
        const animStartPos = 80;
        const houseYCenter = 140;

        const batteriesEnabled = this.config.battery?.show ?? false;
        const batteries = batteriesEnabled ? (this.config.battery?.list ?? []) : [];
        const devices = this.config.home?.devices ?? [];

        let allPaths = '';
        let allLinesBg = '';
        let allLinesMove = '';
        let allDonuts = '';

        // =====================
        // 🌞 BASIS NODES
        // =====================
        allDonuts += this.renderDonut(80, animStartPos, "#ff9800", "☀️", "Zon", "zon");
        allDonuts += this.renderDonut(200, houseYCenter, "#2196f3", "🏠", "Huis", "huis");
        allDonuts += this.renderDonut(320, animStartPos, "#8353d1", "🔌", "Net", "net");

        // =====================
        // ☀️ ZON → HUIS
        // =====================
        const solarPath = `
            M 80 ${animStartPos + 20}
            L 80 ${houseYCenter}
            L 200 ${houseYCenter}
        `;
        allPaths += `<path id="path_solar" d="${solarPath}" />`;
        allLinesBg += `<use class="line-bg" href="#path_solar" />`;
        allLinesMove += `<use class="line-move" id="move_solar" href="#path_solar" />`;

        // =====================
        // 🔌 NET ↔ HUIS
        // =====================
        const gridPath = `
            M 320 ${animStartPos + 20}
            L 320 ${houseYCenter}
            L 200 ${houseYCenter}
        `;
        allPaths += `<path id="path_grid" d="${gridPath}" />`;
        allLinesBg += `<use class="line-bg" href="#path_grid" />`;
        allLinesMove += `<use class="line-move" id="move_grid" href="#path_grid" />`;

        // =====================
        // 🔋 BATTERIJEN
        // =====================
        const batteryY = houseYCenter + 120;
        const batteryStartX = 140;

        batteries.forEach((b, i) => {
            const x = batteryStartX + (i * 140);

            allDonuts += this.renderDonut(
                x,
                batteryY,
                "#4caf50",
                "🔋",
                b.name,
                `bat_${i}`
            );

            const pathId = `path_bat_${i}`;
            const path = `
                M 200 ${houseYCenter + 20}
                L 200 ${batteryY - 40}
                L ${x} ${batteryY - 40}
                L ${x} ${batteryY - 18}
            `;

            allPaths += `<path id="${pathId}" d="${path}" />`;
            allLinesBg += `<use class="line-bg" href="#${pathId}" />`;
            allLinesMove += `<use class="line-move" id="move_bat_${i}" href="#${pathId}" />`;
        });

        // =====================
        // 🔌 HOME DEVICES
        // =====================
        const deviceStartX = 450;
        const deviceStartY = 40;

        devices.forEach((d, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);

            const x = deviceStartX + (col * 100);
            const y = deviceStartY + (row * 80);

            const pathId = `path_dev_${i}`;

            const path = `
                M 200 ${houseYCenter + 20}
                L 200 ${y - 40}
                L ${x} ${y - 40}
                L ${x} ${y - 18}
            `;

            allPaths += `<path id="${pathId}" d="${path}" />`;
            allLinesBg += `<use class="line-bg" href="#${pathId}" />`;
            allLinesMove += `<use class="line-move" id="move_dev_${i}" href="#${pathId}" />`;

            allDonuts += this.renderDonut(
                x,
                y,
                "#03a9f4",
                "🔌",
                d.name,
                `dev_${i}`
            );
        });

        // =====================
        // RENDER SVG
        // =====================
        this.shadowRoot.innerHTML = `
        <ha-card>
            <style>
                .line-bg {
                    fill: none;
                    stroke: #333;
                    stroke-width: 2px;
                }

                .line-move {
                    stroke: #00ffcc;
                    stroke-width: 6;
                    stroke-linecap: round;
                    stroke-dasharray: 0.3, 100;
                    fill: none;
                    filter: drop-shadow(0px 0px 6px #00ffcc);
                    animation: flow 3s linear infinite;
                }

                .line-move.reverse {
                    animation-direction: reverse;
                }

                @keyframes flow {
                    from { stroke-dashoffset: 100; }
                    to { stroke-dashoffset: 0; }
                }

                text {
                    font-size: 12px;
                    fill: white;
                    font-family: sans-serif;
                }
            </style>

            <svg viewBox="0 0 800 ${batteryY + 120}">
                <defs>${allPaths}</defs>
                <g>${allLinesBg}</g>
                <g>${allLinesMove}</g>
                <g>${allDonuts}</g>
            </svg>
        </ha-card>
        `;

        this._initialized = true;
    }

    renderDonut(x, y, color, icon, label, id) {
        return `
        <circle cx="${x}" cy="${y}" r="18" fill="none" stroke="#444" stroke-width="5" />
        <circle id="ring_${id}" cx="${x}" cy="${y}" r="18" fill="none" stroke="${color}" stroke-width="5"
            stroke-dasharray="113" stroke-dashoffset="113"
            transform="rotate(-90 ${x} ${y})" />
        <text x="${x}" y="${y + 4}" text-anchor="middle">${icon}</text>
        <text x="${x + 25}" y="${y - 4}">${label}</text>
        <text id="val_${id}" x="${x + 25}" y="${y + 12}" fill="${color}">0W</text>
        `;
    }

    render() {
        if (!this._hass || !this.config) return;
        if (!this._initialized) this.initialRender();

        // =====================
        // ☀️ SOLAR
        // =====================
        const solar = parseFloat(this._hass.states[this.config.solar?.gateway?.entity]?.state ?? 0);
        const solarEl = this.shadowRoot.getElementById("move_solar");

        if (solarEl) {
            solarEl.style.visibility = solar > 5 ? 'visible' : 'hidden';
        }

        // =====================
        // 🔌 GRID
        // =====================
        const grid = parseFloat(this._hass.states[this.config.grid?.entity]?.state ?? 0);
        const gridEl = this.shadowRoot.getElementById("move_grid");

        if (gridEl) {
            gridEl.style.visibility = Math.abs(grid) > 5 ? 'visible' : 'hidden';
            gridEl.classList.toggle('reverse', grid > 0);
        }

        // =====================
        // 🔋 BATTERIJEN
        // =====================
        if (this.config.battery?.show) {
            (this.config.battery.list ?? []).forEach((b, i) => {
                const power = parseFloat(this._hass.states[b.power]?.state ?? 0);
                const soc = parseFloat(this._hass.states[b.soc]?.state ?? 0);

                const val = this.shadowRoot.getElementById(`val_bat_${i}`);
                if (val) {
                    val.textContent = `${Math.round(power)}W (${Math.round(soc)}%)`;
                }

                const move = this.shadowRoot.getElementById(`move_bat_${i}`);
                if (move) {
                    move.style.visibility = Math.abs(power) > 5 ? 'visible' : 'hidden';
                    move.classList.toggle('reverse', power < 0);
                }
            });
        }

        // =====================
        // 🔌 DEVICES
        // =====================
        (this.config.home?.devices ?? []).forEach((d, i) => {
            const val = parseFloat(this._hass.states[d.entity]?.state ?? 0);

            const el = this.shadowRoot.getElementById(`val_dev_${i}`);
            if (el) {
                el.textContent = `${Math.round(val)}W`;
            }

            const move = this.shadowRoot.getElementById(`move_dev_${i}`);
            if (move) {
                move.style.visibility = val > 5 ? 'visible' : 'hidden';
            }
        });
    }
}

customElements.define("csc-power-card", CscPowerCard);
