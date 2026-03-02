import { NextResponse } from "next/server";
import { dbConnect } from "@/app/api/lib/db";
import Location from "@/app/api/models/locationModel";
import TravelCompany from "@/app/api/models/travelCompanyModel";
import Bus from "@/app/api/models/busModel";
import Order from "@/app/api/models/orderModel";
import Coupon from "@/app/api/models/couponModel";

export async function GET() {
    try {
        await dbConnect();


        // console.log("Clearing existing data...");
        // await Promise.all([
        //     Order.deleteMany({}),
        //     Bus.deleteMany({}),
        //     TravelCompany.deleteMany({}),
        //     Location.deleteMany({}),
        //     Coupon.deleteMany({}),
        // ]);
        // console.log("Data cleared.");

        // --- 1. Create Coupons ---
        // console.log("Creating coupons...");
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const coupons = await Coupon.insertMany([
            { code: 'SAVE20', discount: 20, isActive: true, expiryDate: nextMonth },
            { code: 'FIRST30', discount: 30, isActive: true, expiryDate: nextMonth },
            { code: 'HAPUS10', discount: 10, isActive: true, expiryDate: tomorrow },
        ]);
        // console.log(`${coupons.length} coupons created.`);


        // --- 2. Create Locations ---
        // console.log("Creating locations...");
        const locations = await Location.insertMany([
            { name: "Dadar (E)", address: "Dadar TT Circle", city: "Mumbai", state: "Maharashtra", zip: "400014", latitude: 19.0178, longitude: 72.8478 },
            { name: "Thane (W)", address: "Thane Station Road", city: "Thane", state: "Maharashtra", zip: "400601", latitude: 19.186, longitude: 72.9754 },
            { name: "Panvel", address: "Panvel Bus Stand", city: "Navi Mumbai", state: "Maharashtra", zip: "410206", latitude: 18.9894, longitude: 73.1175 },
            { name: "Borivali (E)", address: "Opp. National Park", city: "Mumbai", state: "Maharashtra", zip: "400066", latitude: 19.2307, longitude: 72.8575 },

            { name: "Ratnagiri", address: "Ratnagiri Bus Depot", city: "Ratnagiri", state: "Maharashtra", zip: "415612", latitude: 16.9902, longitude: 73.312 },
            { name: "Chiplun", address: "Chiplun Bus Stand", city: "Chiplun", state: "Maharashtra", zip: "415605", latitude: 17.5333, longitude: 73.5167 },
            { name: "Kankavli", address: "Kankavli Bus Depot", city: "Kankavli", state: "Maharashtra", zip: "416602", latitude: 16.2665, longitude: 73.7139 },
            { name: "Sawantwadi", address: "Sawantwadi Bus Stand", city: "Sawantwadi", state: "Maharashtra", zip: "416510", latitude: 15.9059, longitude: 73.821 },
            { name: "Mangaon", address: "Mangaon ST Stand", city: "Mangaon", state: "Maharashtra", zip: "402104", latitude: 18.172, longitude: 73.3348 },
            { name: "Devgad", address: "Devgad Bus Stand", city: "Sindhudurg", state: "Maharashtra", zip: "416613", latitude: 16.3793, longitude: 73.3779 },
        ]);

        const [
            dadar, thane, panvel, borivali,
            ratnagiri, chiplun, kankavli, sawantwadi, mangaon
        ] = locations;

        // console.log(`${locations.length} locations created.`);

        // --- 3. Create Travel Companies ---
        // console.log("Creating travel companies...");
        const companies = await TravelCompany.insertMany([
            { name: "Konkan Tours" },
            { name: "Mumbai Roadways" }
        ]);

        const [konkanTours, mumbaiRoadways] = companies;
        // console.log(`${companies.length} companies created.`);

        // --- 4. Create Buses ---
        // console.log("Creating buses...");
        // const today = new Date();
        // today.setHours(0, 0, 0, 0);

        // const busData = [
        //     {
        //         travelCompanyId: konkanTours._id,
        //         busName: "Konkan Queen - Sleeper",
        //         busNumber: "MH-04-KT-001",
        //         contactPersonName: "Mr. Rane",
        //         contactPersonNumber: "9876543210",
        //         capacity: 30,

        //         pricing: [
        //             {
        //                 pickupLocation: dadar._id, dropLocation: ratnagiri._id, fares: {
        //                     'Wooden': 800, 'Plastic / Fibre': 750, 'Iron': 900, 'Electronics': 1000, 'Mango Box': 850, 'Other': 820
        //                 }
        //             },
        //             {
        //                 pickupLocation: dadar._id, dropLocation: chiplun._id, fares: {
        //                     'Wooden': 650, 'Plastic / Fibre': 600, 'Iron': 750, 'Electronics': 850, 'Mango Box': 700, 'Other': 670
        //                 }
        //             },
        //             {
        //                 pickupLocation: thane._id, dropLocation: ratnagiri._id, fares: {
        //                     'Wooden': 750, 'Plastic / Fibre': 700, 'Iron': 850, 'Electronics': 950, 'Mango Box': 800, 'Other': 770
        //                 }
        //             },
        //         ],

        //         availability: Array.from({ length: 7 }).map((_, i) => {
        //             const availableDate = new Date(today);
        //             availableDate.setDate(availableDate.getDate() + i);
        //             availableDate.setHours(21, 30, 0, 0);
        //             return {
        //                 date: availableDate,
        //                 totalCapacityKg: 30,
        //                 availableCapacityKg: Math.floor(Math.random() * 20) + 10, // Range: 10-29
        //             };
        //         }),
        //     },

        //     {
        //         travelCompanyId: konkanTours._id,
        //         busName: "Konkan Tara - Seater",
        //         busNumber: "MH-04-KT-002",
        //         contactPersonName: "Mr. Parab",
        //         contactPersonNumber: "9876543211",
        //         capacity: 45,

        //         pricing: [
        //             {
        //                 pickupLocation: panvel._id, dropLocation: sawantwadi._id, fares: {
        //                     'Wooden': 900, 'Plastic / Fibre': 850, 'Iron': 1000, 'Electronics': 1100, 'Mango Box': 950, 'Other': 920
        //                 }
        //             },
        //             {
        //                 pickupLocation: panvel._id, dropLocation: kankavli._id, fares: {
        //                     'Wooden': 800, 'Plastic / Fibre': 750, 'Iron': 900, 'Electronics': 1000, 'Mango Box': 850, 'Other': 820
        //                 }
        //             },
        //             {
        //                 pickupLocation: dadar._id, dropLocation: ratnagiri._id, fares: {
        //                     'Wooden': 600, 'Plastic / Fibre': 550, 'Iron': 700, 'Electronics': 800, 'Mango Box': 650, 'Other': 620
        //                 }
        //             },
        //         ],

        //         availability: Array.from({ length: 7 }).map((_, i) => {
        //             const availableDate = new Date(today);
        //             availableDate.setDate(availableDate.getDate() + i);
        //             availableDate.setHours(8, 0, 0, 0);
        //             return {
        //                 date: availableDate,
        //                 totalCapacityKg: 45,
        //                 availableCapacityKg: Math.floor(Math.random() * 40) + 5, // Range: 5-44
        //             };
        //         }),
        //     },

        //     {
        //         travelCompanyId: mumbaiRoadways._id,
        //         busName: "Mumbai Express",
        //         busNumber: "MH-01-MR-101",
        //         contactPersonName: "Mr. Yadav",
        //         contactPersonNumber: "9876543212",
        //         capacity: 40,

        //         pricing: [
        //             {
        //                 pickupLocation: borivali._id, dropLocation: mangaon._id, fares: {
        //                     'Wooden': 400, 'Plastic / Fibre': 350, 'Iron': 500, 'Electronics': 600, 'Mango Box': 450, 'Other': 420
        //                 }
        //             },
        //             {
        //                 pickupLocation: thane._id, dropLocation: chiplun._id, fares: {
        //                     'Wooden': 550, 'Plastic / Fibre': 500, 'Iron': 650, 'Electronics': 750, 'Mango Box': 600, 'Other': 570
        //                 }
        //             },
        //         ],

        //         availability: Array.from({ length: 5 }).map((_, i) => {
        //             const availableDate = new Date(today);
        //             availableDate.setDate(availableDate.getDate() + i);
        //             availableDate.setHours(14, 0, 0, 0);
        //             return {
        //                 date: availableDate,
        //                 totalCapacityKg: 40,
        //                 availableCapacityKg: 40, // Always fully available
        //             };
        //         }),
        //     },
        // ];

        // const insertedBuses = await Bus.insertMany(busData);
        // console.log(`${insertedBuses.length} buses created.`);

        return NextResponse.json({
            message: "Sample data inserted successfully.",
            counts: {
                locations: locations.length,
                companies: companies.length,
                // buses: insertedBuses.length,
                coupons: coupons.length,
            },
        });
    } catch (error) {
        console.error("Failed to insert sample data:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "Failed to insert sample data", details: errorMessage },
            { status: 500 }
        );
    }
}
