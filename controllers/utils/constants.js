// Period units in seconds
 const PERIOD_UNITS_IN_SECONDS = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 60 * 60 * 24,
  weeks: 60 * 60 * 24 * 7,
  months: 60 * 60 * 24 * 30,
  years: 60 * 60 * 24 * 365,
};

// Bandwidth units in bytes
const BANDWIDTH_UNITS_IN_BYTES = {
  Bytes: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024,
};


const ITEM_TYPE = {
  1 : 'Digital Files',
  2 : 'Subscription Package',
  3 : 'Digital Product',
  4 : 'Courses',
  5 : 'Wallet Recharge',
  6 : 'Physical Product',
}

const PRODUCT_TYPE ={
  1: 'Physical',
  2: 'Digital',
}

const PRODUCT_STATUS = {
  1 : 'Draft',
  2 : 'Active',
  3 : 'Inactive',
  4 : 'Archived',
}

const PAYMENT_STATUS = {
  1 : 'Pending',
  2 : 'Paid',
  3 : 'Failed',
  4 : 'Refunded',
}

const PAYMENT_METHOD = {
  1 : 'Razorpay',
  2 : 'Manual',
  3: 'Account Balance',
}

// SHARE ALL POSSIBLE ORDER STATUS IN CASE OF PHYSICAL PRODUCT AND DIGITAL PRODUCT

const ORDER_STATUS = {
  1: 'Pending',              // Order placed but not processed yet.
  2: 'Accepted',             // Seller has reviewed and accepted the order.
  3: 'Confirmed',            // Order is confirmed and ready for processing.
  4: 'Processing',           // Order is being prepared or packed.
  5: 'Shipped',              // Order has been shipped (for physical products).
  6: 'Delivered',            // Order delivered to the customer (for physical products).
  7: 'Ready for Pickup',     // Order ready for pickup by the customer (for physical products).
  8: 'Cancelled',            // Order was cancelled by the customer or seller.
  9: 'Returned',             // Order returned by the customer.
  10: 'Refunded',            // Payment refunded to the customer.
  11: 'Failed',              // Order failed due to payment or other issues.
  12: 'In Preparation',      // Order is being prepared for delivery (digital or physical).
  13: 'Dispatched',          // Order dispatched and on the way (for physical products).
  14: 'Download Ready',      // For digital products: Download link or access is available.
  15: 'Access Granted',      // For digital products: User has been granted access to the product.
  16: 'Out for Delivery',    // For physical products: Order is out for delivery.
  17: 'Awaiting Payment',    // Order placed but payment is pending.
  18: 'Awaiting Confirmation', // Awaiting confirmation from the seller or customer.
  19: 'Payment Failed',      // Payment process failed during the order.
  20: 'Partially Fulfilled', // Part of the order has been completed.
  21: 'Hold',                // Order is on hold, usually due to pending information.
  22: 'Archived',            // Order has been archived after completion or inactivity.
};

 const SEARCH_TYPE = {
  WEBSITE: '0',
  PRODUCTS: '1',
  CATEGORIES: '2',
  FILES: '3',
  FOLDERS: '4',
  BLOGS: '5',
};



module.exports = {
  PERIOD_UNITS_IN_SECONDS,
  BANDWIDTH_UNITS_IN_BYTES,
  ITEM_TYPE,
  PAYMENT_STATUS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  SEARCH_TYPE,

};


