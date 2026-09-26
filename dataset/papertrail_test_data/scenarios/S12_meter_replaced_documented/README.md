# S12_meter_replaced_documented

**Regression WITH a documented instrument-cluster replacement**

Rules engine still raises odometer_regression (HIGH), but the entry has a dealer note explaining it. Good test of whether the Claude reconciliation step surfaces the context and asks for the replacement invoice instead of just saying 'tampering'.

Seller's claim: "Single owner. Meter was replaced by company, total run approx 84k."

Expected rules fired: odometer_regression

Images: insurance_1.jpg, insurance_2.jpg, rc.jpg, service_book_p1.jpg, service_book_p2.jpg
