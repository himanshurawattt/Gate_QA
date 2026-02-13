document.addEventListener('DOMContentLoaded', () => {
    let currentInput = '0', previousInput = '', operator = '';
    let resetNext = false, memory = 0, angleMode = 'deg';
    let waitingForSecondOperand = false;
    let pendingPow = false, pendingLogYX = false, pendingYRootX = false;

    const display = document.getElementById('display');
    const expression = document.getElementById('expression');
    const angleRadios = document.querySelectorAll('input[name="angle"]');
    const memoryIndicator = document.getElementById('memory-indicator');

    function updateDisplay() {
        let val = currentInput;
        if (val !== 'Error' && val !== 'Math Error' && val !== 'Infinity' && val.length > 16) val = parseFloat(val).toPrecision(14);
        display.value = val;
    }

    function setAngleMode(mode) { angleMode = mode; }
    function toRad(deg) { return deg * Math.PI / 180; }
    function toDeg(rad) { return rad * 180 / Math.PI; }

    // --- Helper: nthroot (matches real.js) ---
    function nthroot(x, n) {
        try {
            var negate = n % 2 == 1 && x < 0;
            if (negate) x = -x;
            var possible = Math.pow(x, 1 / n);
            n = Math.pow(possible, n);
            if (Math.abs(x - n) < 1 && (x > 0 == n > 0))
                return (negate ? -possible : possible);
            else return (negate ? -possible : possible);
        } catch (e) { return NaN; }
    }

    // --- Helper: gamma function (Lanczos approximation, matches real.js) ---
    function gamma(n) {
        var g = 7,
            p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
        if (n < 0.5) {
            return Math.PI / Math.sin(n * Math.PI) / gamma(1 - n);
        } else {
            n--;
            var x = p[0];
            for (var i = 1; i < g + 2; i++) {
                x += p[i] / (n + i);
            }
            var t = n + g + 0.5;
            return Math.sqrt(2 * Math.PI) * Math.pow(t, (n + 0.5)) * Math.exp(-t) * x;
        }
    }

    // --- Helper: format result precision (matches real.js rounding) ---
    function formatResult(retVal) {
        if (retVal === 0 || retVal === 'Math Error' || retVal === 'Infinity' || retVal === 'Error') return retVal;
        if (typeof retVal === 'string') return retVal;
        if (isNaN(retVal)) return 'Math Error';
        if (!isFinite(retVal)) return 'Infinity';
        if (Math.abs(retVal) < 0.00000001 || Math.abs(retVal) > 100000000) {
            return retVal; // leave in scientific notation
        }
        if (retVal.toFixed(8) % 1 != 0) {
            var i = 1;
            while (i < 10) {
                if ((retVal.toFixed(i) != 0) && (retVal.toFixed(i) / retVal.toFixed(i + 8) == 1)) {
                    return parseFloat(retVal.toFixed(i));
                }
                i++;
            }
        } else {
            return parseFloat(retVal.toFixed(0));
        }
        return retVal;
    }

    // --- Helper: trig with exact-zero handling (matches real.js) ---
    function sinCalc(mode, inputVal) {
        var ipVal = (mode === 'deg') ? inputVal * Math.PI / 180 : inputVal;
        if (parseFloat((ipVal.toFixed(8) % Math.PI).toFixed(8)) === 0) return 0;
        return Math.sin(ipVal);
    }

    function cosCalc(mode, inputVal) {
        var ipVal = (mode === 'deg') ? inputVal * Math.PI / 180 : inputVal;
        var halfPi = Math.PI / 2;
        if (parseFloat(ipVal.toFixed(8)) % parseFloat(halfPi.toFixed(8)) == 0) {
            if (parseFloat((ipVal.toFixed(8) / halfPi).toFixed(8)) % 2 == 0) {
                return Math.cos(ipVal);
            } else {
                return 0;
            }
        }
        return Math.cos(ipVal);
    }

    function tanCalc(mode, inputVal) {
        var ipVal = (mode === 'deg') ? inputVal * Math.PI / 180 : inputVal;
        var halfPi = Math.PI / 2;
        if (ipVal % halfPi == 0) {
            if ((ipVal / halfPi) % 2 == 0) {
                return 0;
            } else {
                return 'Math Error';
            }
        }
        return Math.tan(ipVal);
    }

    // --- Helper: inverse trig with domain validation (matches real.js) ---
    function sinInvCalc(mode, inputVal) {
        var ipVal = Math.asin(inputVal);
        if (isNaN(ipVal)) return 'Math Error';
        return (mode === 'deg') ? (180 / Math.PI) * ipVal : ipVal;
    }

    function cosInvCalc(mode, inputVal) {
        var ipVal = Math.acos(inputVal);
        if (isNaN(ipVal)) return 'Math Error';
        return (mode === 'deg') ? (180 / Math.PI) * ipVal : ipVal;
    }

    function tanInvCalc(mode, inputVal) {
        var ipVal = Math.atan(inputVal);
        if (isNaN(ipVal)) return 'Math Error';
        return (mode === 'deg') ? (180 / Math.PI) * ipVal : ipVal;
    }

    // Event Listeners for Angle Mode
    angleRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            setAngleMode(e.target.value);
        });
    });

    function inputChar(ch) {
        if (resetNext) { currentInput = ''; resetNext = false; }
        if (ch === '.' && currentInput.includes('.')) return;
        if (currentInput === '0' && ch !== '.') currentInput = ch;
        else currentInput += ch;
        updateDisplay();
    }

    function inputOp(op) {
        if (waitingForSecondOperand && operator) calculate();
        previousInput = currentInput;
        operator = op;
        expression.value = currentInput + ' ' + op;
        resetNext = true; waitingForSecondOperand = true;
    }

    function calculate() {
        if (pendingPow) {
            const b = parseFloat(previousInput), e = parseFloat(currentInput);
            expression.value = previousInput + ' ^ ' + currentInput + ' =';
            let result = Math.pow(b, e);
            // Precision guard matching real.js
            if (b == 10 && result % 10 != 0 && (Math.abs(result) < 0.00000001 || Math.abs(result) > 100000000) && e % 1 == 0)
                result = parseFloat(result.toPrecision(7));
            currentInput = String(formatResult(result));
            pendingPow = false; updateDisplay(); resetNext = true; waitingForSecondOperand = false; return;
        }
        if (pendingLogYX) {
            const y = parseFloat(previousInput), x = parseFloat(currentInput);
            expression.value = 'log_' + previousInput + '(' + currentInput + ') =';
            currentInput = String(formatResult(Math.log(x) / Math.log(y)));
            pendingLogYX = false; updateDisplay(); resetNext = true; waitingForSecondOperand = false; return;
        }
        if (pendingYRootX) {
            const y = parseFloat(previousInput), x = parseFloat(currentInput);
            expression.value = previousInput + '√' + currentInput + ' =';
            currentInput = String(formatResult(nthroot(x, y)));
            pendingYRootX = false; updateDisplay(); resetNext = true; waitingForSecondOperand = false; return;
        }
        if (!operator || !waitingForSecondOperand) return;
        const a = parseFloat(previousInput), b = parseFloat(currentInput);
        let result;
        switch (operator) {
            case '+': result = a + b; break;
            case '-': result = a - b; break;
            case '*': result = a * b; break;
            case '/': result = b !== 0 ? a / b : 'Error'; break;
            case 'mod': result = a % b; break;
            case 'exp_op': result = a * Math.pow(10, b); break;
            case '%': result = a / 100 * b; break;
            default: return;
        }
        expression.value = previousInput + ' ' + operator + ' ' + currentInput + ' =';
        currentInput = String(formatResult(result));
        operator = ''; waitingForSecondOperand = false;
        updateDisplay(); resetNext = true;
    }

    function clearAll() {
        currentInput = '0'; previousInput = ''; operator = '';
        expression.value = '';
        resetNext = false;
        waitingForSecondOperand = false;
        pendingPow = false; pendingLogYX = false; pendingYRootX = false;
        updateDisplay();
    }

    function backspace() {
        if (currentInput.length > 1) currentInput = currentInput.slice(0, -1);
        else currentInput = '0';
        updateDisplay();
    }

    function toggleSign() {
        currentInput = String(-parseFloat(currentInput));
        updateDisplay();
    }

    function calcPercent() {
        if (waitingForSecondOperand && operator) calculate();
        previousInput = currentInput;
        operator = '%';
        expression.value = currentInput + ' %';
        resetNext = true; waitingForSecondOperand = true;
    }

    function calcFn(fn) {
        const val = parseFloat(currentInput);
        let result;
        switch (fn) {
            case 'sqrt': result = Math.sqrt(val); expression.value = '√(' + val + ')'; break;
            case 'square': result = val * val; expression.value = val + '²'; break;
            case 'cube': result = val * val * val; expression.value = val + '³'; break;
            case 'recip': result = val !== 0 ? 1 / val : 'Math Error'; expression.value = '1/(' + val + ')'; break;
            case 'abs': result = Math.abs(val); expression.value = '|' + val + '|'; break;
            case 'cbrt': result = nthroot(val, 3); expression.value = '∛(' + val + ')'; break;
            case 'ln': result = Math.log(val); expression.value = 'ln(' + val + ')'; break;
            case 'log': result = Math.log(val) / Math.LN10; expression.value = 'log(' + val + ')'; break;
            case 'log2': result = Math.log(val) / Math.log(2); expression.value = 'log₂(' + val + ')'; break;
            case 'exp': result = Math.exp(val); expression.value = 'eˣ(' + val + ')'; break;
            case 'tenx':
                result = Math.pow(10, val);
                // Precision guard matching real.js
                if (result % 10 != 0 && (Math.abs(result) < 0.00000001 || Math.abs(result) > 100000000) && (val % 1 == 0))
                    result = parseFloat(result.toPrecision(7));
                expression.value = '10^(' + val + ')';
                break;
            case 'fact': result = factorial(val); expression.value = val + '!'; break;
            case 'sinh': result = (Math.pow(Math.E, val) - Math.pow(Math.E, -val)) / 2; expression.value = 'sinh(' + val + ')'; break;
            case 'cosh': result = (Math.pow(Math.E, val) + Math.pow(Math.E, -val)) / 2; expression.value = 'cosh(' + val + ')'; break;
            case 'tanh':
                result = (Math.pow(Math.E, val) - Math.pow(Math.E, -val)) / (Math.pow(Math.E, val) + Math.pow(Math.E, -val));
                expression.value = 'tanh(' + val + ')';
                break;
            case 'asinh': result = Math.log(val + Math.sqrt(val * val + 1)); expression.value = 'sinh⁻¹(' + val + ')'; break;
            case 'acosh': result = Math.log(val + Math.sqrt(val + 1) * Math.sqrt(val - 1)); expression.value = 'cosh⁻¹(' + val + ')'; break;
            case 'atanh': result = 0.5 * (Math.log(1 + val) - Math.log(1 - val)); expression.value = 'tanh⁻¹(' + val + ')'; break;
            default: return;
        }
        currentInput = String(formatResult(result)); updateDisplay(); resetNext = true;
    }

    function calcTrig(fn) {
        let val = parseFloat(currentInput); let result;
        switch (fn) {
            case 'sin': result = sinCalc(angleMode, val); break;
            case 'cos': result = cosCalc(angleMode, val); break;
            case 'tan': result = tanCalc(angleMode, val); break;
            case 'asin': result = sinInvCalc(angleMode, val); break;
            case 'acos': result = cosInvCalc(angleMode, val); break;
            case 'atan': result = tanInvCalc(angleMode, val); break;
            default: return;
        }
        expression.value = fn + '(' + val + ')';
        currentInput = String(formatResult(result)); updateDisplay(); resetNext = true;
    }

    // Factorial matching real.js: overflow guard, negative guard, gamma for non-integers
    function factorial(n) {
        if (n > 170) return 'Infinity';
        if (n < 0) return 'Math Error';
        if (n === 0 || n === 1) return 1;
        if (n % 1 !== 0) return gamma(n + 1); // non-integer: use gamma
        let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
    }

    function calcMod() {
        if (waitingForSecondOperand && operator) calculate();
        previousInput = currentInput; operator = 'mod';
        expression.value = currentInput + ' mod';
        resetNext = true; waitingForSecondOperand = true;
    }

    function calcExp() {
        if (waitingForSecondOperand && operator) calculate();
        previousInput = currentInput;
        operator = 'exp_op';
        expression.value = currentInput + ' × 10^';
        resetNext = true; waitingForSecondOperand = true;
    }

    function calcPow() {
        previousInput = currentInput; pendingPow = true;
        expression.value = currentInput + ' ^';
        resetNext = true; waitingForSecondOperand = true;
    }
    function calcLogYX() {
        previousInput = currentInput; pendingLogYX = true;
        expression.value = 'log_' + currentInput + '(x)';
        resetNext = true; waitingForSecondOperand = true;
    }
    function calcYRootX() {
        previousInput = currentInput; pendingYRootX = true;
        expression.value = currentInput + '√x';
        resetNext = true; waitingForSecondOperand = true;
    }

    function insertConst(val) {
        currentInput = String(val); updateDisplay(); resetNext = true;
    }

    function showMemoryIndicator() { if (memoryIndicator) memoryIndicator.classList.add('memoryshow'); }
    function hideMemoryIndicator() { if (memoryIndicator) memoryIndicator.classList.remove('memoryshow'); }

    function memoryClear() { memory = 0; hideMemoryIndicator(); }
    function memoryRecall() { currentInput = String(memory); updateDisplay(); resetNext = true; }
    function memoryStore() { memory = parseFloat(currentInput); showMemoryIndicator(); }
    function memoryAdd() { memory += parseFloat(currentInput); showMemoryIndicator(); }
    function memorySub() { memory -= parseFloat(currentInput); showMemoryIndicator(); }

    // Click Delegation
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        const val = btn.dataset.val;

        if (!action && !val) return; // Ignore if no data attributes

        switch (action) {
            case 'num': inputChar(val); break;
            case 'op': inputOp(val); break;
            case 'fn': calcFn(val); break;
            case 'trig': calcTrig(val); break;
            case 'const': insertConst(val === 'PI' ? Math.PI : Math.E); break;
            case 'calc': calculate(); break;
            case 'clear': clearAll(); break;
            case 'backspace': backspace(); break;
            case 'sign': toggleSign(); break;
            case 'percent': calcPercent(); break;
            case 'mod': calcMod(); break;
            case 'exp': calcExp(); break;
            case 'pow': calcPow(); break;
            case 'logyx': calcLogYX(); break;
            case 'yroot': calcYRootX(); break;
            case 'mc': memoryClear(); break;
            case 'mr': memoryRecall(); break;
            case 'ms': memoryStore(); break;
            case 'm+': memoryAdd(); break;
            case 'm-': memorySub(); break;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === '=') calculate();
    });
});
