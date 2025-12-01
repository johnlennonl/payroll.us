import { PDFDocument, StandardFonts } from 'pdf-lib';
import templateURL from '../assets/BUY_ORDR_template.pdf';

/**
 * Rellena el PDF de Buy Order con los datos del order.
 * Detecta automáticamente si el PDF tiene campos de formulario (AcroForm)
 * o si requiere texto posicionado por coordenadas.
 * 
 * @param {Object} order - Objeto con datos del Buy Order desde Firestore
 * @returns {Promise<void>} Descarga el PDF relleno
 */
export async function fillBuyOrderPDF(order, { debug = false } = {}) {
  try {
    // 1. Cargar el template PDF
    const existingPdfBytes = await fetch(templateURL).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // 2. Intentar obtener el formulario (AcroForm)
    const form = pdfDoc.getForm();
    // Embedir fuentes estándar para controlar apariencia (uniformidad)
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const _helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    try {
      form.updateFieldAppearances(helv);
    } catch (e) {
      console.warn('No se pudo actualizar apariencias de campos:', e.message);
    }
    const fields = form.getFields();

    console.log('📄 PDF Form Fields detectados:', fields.length);
    fields.forEach(field => {
      const name = field.getName();
      const type = field.constructor.name;
      console.log(`  - ${name} (${type})`);
    });

    // 3. Si hay campos de formulario, rellenarlos
    if (fields.length > 0) {
      // Preparar datos procesados
      const stateTax = order.taxItems?.find(t => t.key === 'state')?.amount || 0;
      const cityTax = order.taxItems?.find(t => t.key === 'city')?.amount || 0;
      const countyTax = order.taxItems?.find(t => t.key === 'county')?.amount || 0;
      const rtdTax = order.taxItems?.find(t => t.key === 'rtd')?.amount || 0;
      const cdTax = order.taxItems?.find(t => t.key === 'cd')?.amount || 0;
      const rtdCombined = rtdTax + cdTax;

      // Calcular TOTAL (precio + taxes) y TOTAL OTHER FEES
      const totalTaxes = stateTax + cityTax + countyTax + rtdCombined;
      const totalPrice = (order.price || 0) + totalTaxes;
      const totalOtherFees = totalPrice + (order.fee || 0);
      const totalCashDown = order.downPayment || 0;
      const amountToFinance = totalOtherFees - totalCashDown;

      // Formato profesional para números y datos
      const formatCurrency = (num) => {
        if (num === null || num === undefined || num === '' || isNaN(num)) return '';
        return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      // Valores formateados clave
      const sellingPriceFormatted = order.price ? formatCurrency(order.price) : '';
      const totalWithTaxesFormatted = totalPrice ? formatCurrency(totalPrice) : '';
      const totalOtherFeesFormatted = totalOtherFees ? formatCurrency(totalOtherFees) : '';
      // Asegurar Trade Allowance (normalmente 0) - cubrir variantes de nombre de campo
      const tradeAllowanceValue = formatCurrency(order.tradeAllowance ?? 0);

      // Mapeo directo de campos del PDF (solo los relevantes y ordenados)
      const fieldMappings = {
        // === HEADER INFO ===
        'DlrName': 'WEST AUTOMOTIVE LLC',
        'DlrAddress': '1826 E Platte Ave Suite 224 E',
        'DlrCSZ': 'Colorado Springs, CO 80909',
        'DlrPh': '719-822-6527',
        'Slsmn': order.salesman || '',
        'StockNo': order.stockNumber || '',
        'DealDate': order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US'),

        // === PURCHASER INFO ===
        'Buyer': order.buyerName || '',
        'Address': order.address || '',
        'BuyerCSZ': `${order.city || ''}, ${order.state || ''} ${order.zip || ''}`.trim(),
        'HomePh': order.phone || '',
        'BuyerDL': order.licenseNumber || '',
        'BuyerDOB': order.birthDate || order.dob || '',

        // === VEHICLE INFO ===
        'Yr': order.year || '',
        'Make': order.make || '',
        'Model': order.model || '',
        'Body': order.body || '',
        'Color': order.color || '',
        'Miles': order.mileage && !isNaN(order.mileage) ? String(order.mileage) : '',
        'VIN': order.vin || '',
        'Cyl': order.cylinders || '',
        'FuelType': order.fuelType || '',

        // === PRICING ===
        'Price': order.price ? formatCurrency(order.price) : '', // Selling Price (venta)
        // Según indicación: SalesPrice debe mostrar totalWithTaxes (precio + taxes)
        'SalesPrice': totalWithTaxesFormatted ? totalWithTaxesFormatted : '',

        // === TAXES ===
        'StTax': stateTax ? formatCurrency(stateTax) : '',
        // La plantilla ya muestra el símbolo '%', aquí ponemos solo el número (dos decimales)
        'StTaxRate': (() => {
          const item = order.taxItems?.find(t => t.key === 'state');
          const pct = item ? (item.pctPercent ?? (item.pct ? item.pct * 100 : null)) : null;
          return pct !== null && pct !== undefined ? Number(pct).toFixed(2) : '';
        })(),
        'CityTax': cityTax ? formatCurrency(cityTax) : '',
        'CityTaxRate': (() => {
          const item = order.taxItems?.find(t => t.key === 'city');
          const pct = item ? (item.pctPercent ?? (item.pct ? item.pct * 100 : null)) : null;
          return pct !== null && pct !== undefined ? Number(pct).toFixed(2) : '';
        })(),
        'MiscTax': countyTax ? formatCurrency(countyTax) : '',
        'MiscTaxRate': (() => {
          const item = order.taxItems?.find(t => t.key === 'county');
          const pct = item ? (item.pctPercent ?? (item.pct ? item.pct * 100 : null)) : null;
          return pct !== null && pct !== undefined ? Number(pct).toFixed(2) : '';
        })(),
        'RTDTax': rtdCombined ? formatCurrency(rtdCombined) : '',
        'RTDTaxRate': (() => {
          const rtdItem = order.taxItems?.find(t => t.key === 'rtd');
          const cdItem = order.taxItems?.find(t => t.key === 'cd');
          const rtdPct = rtdItem ? (rtdItem.pctPercent ?? (rtdItem.pct ? rtdItem.pct * 100 : 0)) : 0;
          const cdPct = cdItem ? (cdItem.pctPercent ?? (cdItem.pct ? cdItem.pct * 100 : 0)) : 0;
          const total = (Number(rtdPct) || 0) + (Number(cdPct) || 0);
          return total ? Number(total).toFixed(2) : '';
        })(),

        // === FEES Y TOTALES ===
        'FilingFee': order.fee ? formatCurrency(order.fee) : '',
        'FilingFeeDesc': order.fee ? 'Filing Fee' : '',
        // TOTAL OTHER FEES = totalWithTaxes + filing fee
        // Según indicación: el campo 'Fees' contendrá totalOtherFees
        'TotalFees': '', // debe quedar vacío según solicitud
        'Payoff': '', // dejar vacío según solicitud
        'Fees': totalOtherFeesFormatted ? totalOtherFeesFormatted : '',
        // Alias adicional: campo genérico 'Total' por si existe (lo dejamos con totalWithTaxes)
        'Total': totalWithTaxesFormatted ? totalWithTaxesFormatted : '',

        // === PAYMENTS ===
        'CashDn': totalCashDown ? formatCurrency(totalCashDown) : '', // TOTAL CASH DOWN PAYMENT
        'AmtFin': amountToFinance ? formatCurrency(amountToFinance) : '' // AMOUNT TO FINANCE
      };

      // Normalizar y preparar aliases comunes (sin espacios ni signos)
      const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedFieldMappings = {};
      Object.keys(fieldMappings).forEach(k => {
        normalizedFieldMappings[normalize(k)] = fieldMappings[k];
      });

      // Añadir aliases explícitos para campos problemáticos de totales (variantes que aparecen en plantillas)
      const aliases = {
        // Total debajo de Plus Pay Off / Balance Owed (subtotal + taxes)
        'total': totalWithTaxesFormatted,
        'subtotal': sellingPriceFormatted,
        'balanceowed': totalWithTaxesFormatted,
        'pluspayoff': totalWithTaxesFormatted,
        'totalwithtaxes': totalWithTaxesFormatted,

        // Variantes para TOTAL OTHER FEES (total + filing fee)
        'totalotherfees': totalOtherFeesFormatted,
        'totalother': totalOtherFeesFormatted,
        'otherfees': totalOtherFeesFormatted,
        // 'totalfees' debe quedar vacío según usuario; mapeamos explícitamente a '' abajo
        'total_other_fees': totalOtherFeesFormatted,
        'fees': totalOtherFeesFormatted,

        // Pagos
        'cashdn': totalCashDown ? formatCurrency(totalCashDown) : '',
        'totalcashdownpayment': totalCashDown ? formatCurrency(totalCashDown) : '',
        'amounttofinance': amountToFinance ? formatCurrency(amountToFinance) : '',
        'amtfin': amountToFinance ? formatCurrency(amountToFinance) : ''
      };
      Object.keys(aliases).forEach(k => normalizedFieldMappings[k] = aliases[k]);

      // Forzar campos que deben quedar vacíos según la instrucción del usuario
      normalizedFieldMappings['totalfees'] = '';
      normalizedFieldMappings['payoff'] = '';
      // Asegurar que salesprice apunta a totalWithTaxes
      normalizedFieldMappings['salesprice'] = totalWithTaxesFormatted;

      // (Se consolidará el rellenado de campos más abajo)

      // Rellenar campos (consolidado): validar tipo, setear texto y fijar fuente 12pt
      let filledCount = 0;
      let subtotalFilled = false; // marca si ya colocamos el TOTAL que corresponde al Selling Price
      for (const field of fields) {
        try {
          const fieldName = field.getName();
          const fieldType = field.constructor.name;

          // Aceptar solo campos de texto
          if (!fieldType.startsWith('PDFTextField')) {
            console.log(`⏭️ Saltando campo "${fieldName}" (${fieldType})`);
            continue;
          }

          // Resolver valor a partir del mapeo base
          let value = fieldMappings[fieldName];
          // Intentar por nombre normalizado/alias si no hay mapeo directo
          if ((value === undefined || value === null || String(value).trim() === '') && typeof normalize === 'function') {
            const n = normalize(fieldName);
            if (normalizedFieldMappings[n] !== undefined) {
              value = normalizedFieldMappings[n];
            }
          }

          // Normalizar nombre para reglas
          const fname = String(fieldName || '').trim();
          const lname = fname.toLowerCase();

          // Prioridad explícita por nombre de campo (evita heurísticas frágiles)
          // 1) Trade / Allow
          if (!value && /\b(allow|trade|used vehicle allowance|usedvehicleallowance|allowance)\b/i.test(lname)) {
            value = tradeAllowanceValue;
          }

          // 2) Selling Price / Price / SalesPrice / SubTotal (subtotal visual)
          if (!value && /^(price|salesprice|sellingprice)$/i.test(fname)) {
            value = sellingPriceFormatted;
          }
          if (!value && /^subtotal$/i.test(fname)) {
            value = sellingPriceFormatted;
            subtotalFilled = true;
          }

          // 3) Taxes y porcentajes ya manejados por fieldMappings (StTax, CityTax, etc.)

          // 4) TOTALS: los alias normalizados manejan Total/Fees/Other
          // (Se evita sobrescribir aquí para respetar las asignaciones explícitas)

          // Total con taxes (el total mostrado debajo de Plus Pay Off) -> buscar nombres típicos
          if (!value && /\b(total|balanceowed|pluspayoff|totalwithtaxes|totalamount)\b/i.test(lname) && !/other/i.test(lname)) {
            // Si SubTotal fue llenado, éste es el siguiente TOTAL (total con taxes)
            if (!subtotalFilled) {
              // Si aún no se llenó SubTotal, asumir Selling Price aquí
              value = sellingPriceFormatted;
              subtotalFilled = true;
            } else {
              value = totalWithTaxesFormatted;
            }
          }

          // 5) FilingFee ya mapeado, pero asegurar Amounts de pagos
          if (!value && /^cashdn$/i.test(fname)) {
            value = totalCashDown ? formatCurrency(totalCashDown) : '';
          }
          if (!value && /^amtfin$/i.test(fname)) {
            value = amountToFinance ? formatCurrency(amountToFinance) : '';
          }

          // 6) Finalmente, si fieldMappings tenía un valor lo respetamos
          if ((value === undefined || value === null) && fieldMappings[fieldName] !== undefined) {
            value = fieldMappings[fieldName];
          }

          // Si estamos en modo debug, en lugar del valor real ponemos el nombre del campo
          if (debug) {
            const debugLabel = String(fieldName);
            try {
              field.setText(debugLabel);
              if (field.setFontSize) field.setFontSize(8);
              console.log(`🐞 [debug] "${fieldName}" marcado en la celda`);
              filledCount++;
              continue;
            } catch (e) {
              console.warn(`No se pudo escribir debug label en "${fieldName}":`, e.message);
            }
          }

          if (value !== undefined && value !== null && String(value).trim() !== '') {
            field.setText(String(value));
            // Forzar fuente embebida para consistencia si está disponible
            try {
              if (typeof helv !== 'undefined' && field.setFont) field.setFont(helv);
            } catch {
              // no crítico
            }
            // Usar tamaño más grande para el nombre del dealer (titulo)
            if (field.setFontSize) {
              if (/^DlrName$/i.test(fieldName)) field.setFontSize(14);
              // Reducir 0.5pt para VIN para que se muestre completo
              else if (/vin/i.test(fieldName)) field.setFontSize(11.5);
              else field.setFontSize(12);
            }
            // Intentar alinear a la derecha para campos numéricos clave
            try {
              if (field.setAlignment) {
                if (/\b(Price|Allow|CityTax|StTax|SalesPrice|CashDn|AmtFin|FilingFee|Fees|TotalFees)\b/i.test(fieldName)) {
                  field.setAlignment('right');
                }
              }
            } catch {
              // algunos viewers no soportan setAlignment; ignorar
            }
            filledCount++;
            console.log(`✅ "${fieldName}" = "${value}"`);
          } else {
            console.log(`⚠️ "${fieldName}" - sin valor`);
          }
        } catch (err) {
          console.error(`❌ Error en campo "${field.getName()}":`, err.message);
        }
      }

      console.log(`\n📊 Total campos rellenados: ${filledCount}/${fields.length}`);

      if (filledCount === 0) {
        alert('⚠️ No se pudo rellenar ningún campo. Revisa la consola para ver los nombres de los campos del PDF.');
      }

      // Aplanar el formulario para que no sea editable
      form.flatten();

      // Nota: el encabezado se rellena mediante campos del formulario (DlrName, DlrAddress, DlrCSZ, DlrPh).
      // Eliminado el dibujo manual del encabezado para evitar duplicados.
    } else {
      // 4. Si NO hay campos de formulario, usar coordenadas
      // Esto requiere inspeccionar el PDF manualmente para obtener posiciones exactas
      console.warn('⚠️ PDF sin campos de formulario detectados. Rellenando con coordenadas...');
      
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { height } = firstPage.getSize();

      // Ejemplo de texto posicionado (ajustar coordenadas según PDF real)
      firstPage.drawText(`Stock#: ${order.stockNumber || ''}`, {
        x: 50,
        y: height - 100,
        size: 10,
      });

      firstPage.drawText(`Purchaser: ${order.buyerName || ''}`, {
        x: 50,
        y: height - 120,
        size: 10,
      });

      // ... continuar con más campos según necesidad
      // Nota: Este método es menos robusto y requiere ajuste manual
    }

    // 5. Guardar y descargar el PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BUY_ORDER_${order.buyerName?.replace(/\s+/g, '_') || 'unknown'}_${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);

    console.log('✅ PDF generado y descargado exitosamente');
  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    alert(`Error generando PDF: ${error.message}`);
    throw error;
  }
}
