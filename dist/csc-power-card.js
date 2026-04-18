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
        const devices = this.config.home?.devices ?? [];
        const batteriesEnabled = this.config.battery?.show ?? false;
        const batteries = batteriesEnabled ? (this.config.battery?.list ?? []) : [];

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

        // ☀️ SOLAR GROUPS
        groups.forEach((group, groupIdx) => {
            const startYPos = groupPositions[groupIdx];
            const relayY = startYPos + 32;

            (group.entities || []).forEach((item, i) => {
                const col = i % 4;
                const row = Math.floor(i / 4);
                const x = 60 + (col * 93);
                const y = startYPos + 60 + (row * 70);

                allDonuts += this.renderDonutStatic(x, y, "yellow", "☀️", `P${i+1}`, `g${groupIdx}_i${i}`);
            });
        });

        // 🌞 BASIS DONUTS
        allDonuts += this.renderDonutStatic(80, animStartPos, "#ff9800", "☀️", "Zon", "zon", 25, 8, 25);
        allDonuts += this.renderDonutStatic(200, houseYCenter, "#2196f3", "🏠", "Huis", "huis", 25, 8, 25);
        allDonuts += this.renderDonutStatic(320, animStartPos, "#8353d1", "🔌", "Net", "net", 25, 8, 25);

        // 🔋 BATTERIJEN
        const batteryY = houseYCenter + 120;
        const batteryStartX = 140;

        batteries.forEach((b, i) => {
            const x = batteryStartX + (i * 140);

            allDonuts += this.renderDonutStatic(
                x,
                batteryY,
                "#4caf50",
                "🔋",
                b.name,
                `bat_${i}`,
                25,
                8,
                25
            );

            const pathId = `path_bat_${i}`;
            const pathD = `M 200 ${houseYCenter + 25} L 200 ${batteryY - 40} L ${x} ${batteryY - 40} L ${x} ${batteryY - 18}`;

            allPaths += `<path id="${pathId}" d="${pathD}" />`;
            allLinesBg += `<use class="line-bg" href="#${pathId}" />`;
            allLinesMove += `<use class="line-move" id="move_bat_${i}" href="#${pathId}" />`;
        });

        this.shadowRoot.innerHTML = `
        <ha-card>
            <svg viewBox="0 0 800 ${batteryY + 100}">
                <defs>${allPaths}</defs>
                ${allLinesBg}
                ${allLinesMove}
                ${allDonuts}
            </svg>
        </ha-card>`;

        this._initialized = true;
    }

    renderDonutStatic(x, y, color, icon, label, id, iconSize = 14, iconY = 5, radius = 18, fontsize = 14) {
        return `
        <circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="#444" stroke-width="5" />
        <circle id="ring_${id}" cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${color}" stroke-width="5"
            stroke-dasharray="113" stroke-dashoffset="113"
            transform="rotate(-90 ${x} ${y})" />
        <text x="${x}" y="${y + iconY}" text-anchor="middle">${icon}</text>
        <text x="${x + 25}" y="${y - 4}">${label}</text>
        <text id="val_${id}" x="${x + 25}" y="${y + 12}" fill="${color}">0</text>
        `;
    }

    render() {
        if (!this._hass || !this.config) return;
        if (!this._initialized) this.initialRender();

        // 🔋 BATTERIJ UPDATE
        if (this.config.battery?.show) {
            (this.config.battery.list ?? []).forEach((b, i) => {
                const power = parseFloat(this._hass.states[b.power]?.state ?? 0);
                const soc = parseFloat(this._hass.states[b.soc]?.state ?? 0);

                const valEl = this.shadowRoot.getElementById(`val_bat_${i}`);
                if (valEl) {
                    valEl.textContent = `${Math.round(power)}W (${Math.round(soc)}%)`;
                }

                const moveEl = this.shadowRoot.getElementById(`move_bat_${i}`);
                if (moveEl) {
                    if (power < 0)
                        moveEl.classList.add('reverse');
                    else
                        moveEl.classList.remove('reverse');

                    moveEl.style.visibility = Math.abs(power) > 5 ? 'visible' : 'hidden';
                }
            });
        }
    }
}

customElements.define("csc-power-card", CscPowerCard);
