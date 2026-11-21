var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('invoice uses HSN GST slabs like pricing', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, total: billed.total });

  assert.deepEqual(billed.lines.map(function (line) { return line.gstPercent; }), [5, 18]);
  assert.equal(billed.tax, 23);
  assert.equal(billed.total, 223);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
  assert.doesNotMatch(invoice.render({ id: 1, items: items, total: billed.total }), /differs from Order Ledger recorded total/);
});

test('invoice interprets a decimal gstRate as a decimal rate', function () {
  var items = [{ name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({ items: items, total: billed.total });

  assert.equal(billed.tax, 5);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
});

test('invoice coupon totals and line GST match checkout pricing', function () {
  var cases = [
    {
      coupon: 'SAVE10',
      items: [
        { id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 1 },
        { id: 2, name: 'Oil', hsn: '1512', price: 420, qty: 1 }
      ]
    },
    {
      coupon: 'SAVE10',
      items: [{ id: 3, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }]
    },
    {
      coupon: 'FLAT50',
      items: [
        { id: 4, name: 'Ghee', hsn: '0405', price: 500, qty: 1 },
        { id: 5, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
      ]
    },
    {
      coupon: 'WELCOME',
      items: [{ id: 6, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }]
    }
  ];

  cases.forEach(function (order) {
    var billed = pricing.computeTotals(order.items, order.coupon);
    var invoiceFigures = invoice.computeInvoiceFigures(order);

    assert.deepEqual({
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total
    }, {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total
    });
    assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.lineTax; }), billed.lines.map(function (line) { return line.tax; }));
  });

  var capped = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ id: 7, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }]
  });
  assert.equal(capped.discount, 150);
});

test('invoice rounds tax lines and splits GST like checkout pricing', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [
      { name: 'A', price: 0.05, qty: 1, gstRate: 10 },
      { name: 'B', price: 0.05, qty: 1, gstRate: 10 }
    ]
  });

  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.cgst + figures.sgst, figures.tax);
  assert.equal(tax.splitCgstSgst(0.02).cgst, 0.01);
});
