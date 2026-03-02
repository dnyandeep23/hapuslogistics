"use client";
import React from "react";
const RecentSales = () => {
  const sales = [
    { name: "Olivia Martin", email: "olivia.martin@email.com", amount: "+$1,999.00" },
    { name: "Jackson Lee", email: "jackson.lee@email.com", amount: "+$39.00" },
    { name: "Isabella Nguyen", email: "isabella.nguyen@email.com", amount: "+$299.00" },
    { name: "William Kim", email: "will@email.com", amount: "+$99.00" },
    { name: "Sofia Davis", email: "sofia.davis@email.com", amount: "+$39.00" },
  ];
  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">Recent Sales</h2>
      <div className="space-y-4">
        {sales.map((sale, index) => (
          <div key={index} className="flex items-center">
            <div className="flex-1">
              <p className="font-semibold">{sale.name}</p>
              <p className="text-sm text-gray-500">{sale.email}</p>
            </div>
            <p className="font-semibold">{sale.amount}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default RecentSales;
