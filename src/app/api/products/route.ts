import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../lib/dbconnection";
// redisClient from "../lib/redisClient";
import categoryConfig from "./categoryConfig";
import redis from "../lib/redisClient";
// import kv from '@vercel/kv';
// import { createClient } from 'redis';

export async function POST(req, res) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { name, categoryPath, image, discountedPrice, price, size } =
      await req.json();

    if (
      !name ||
      !categoryPath ||
      !Array.isArray(categoryPath) ||
      categoryPath.length === 0 ||
      !discountedPrice ||
      !price ||
      !size
    ) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    // Create new product document with a generated _id and image
    const newProduct = {
      _id: new ObjectId(),
      name,
      categoryPath: categoryPath.map((id) => new ObjectId(id)),
      image: image || null, // Add image key, default to null if not provided
      discountedPrice,
      price,
      size,
    };

    // Insert new product into the products collection
    const result = await db.collection("products").insertOne(newProduct);

    if (result.insertedCount === 0) {
      return NextResponse.json(
        { message: "Product creation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Product created successfully",
        productData: newProduct,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(req, res) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!categoryId) {
      return NextResponse.json(
        { message: "Missing category ID" },
        { status: 400 }
      );
    }

    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const cacheKey = `products:${categoryId}:page:${page}:limit:${limit}`;
    console.log("iuytrdfghjkl", cacheKey);
    // const redis =  await createClient({ url: process.env.REDIS_URL }).connect();

    let cachedData = null;
    try{
      cachedData = await redis.get(cacheKey);
    }catch(error){
      console.log("error", error);
    }
   
    

    

    // const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      console.log("cached76544567890");
      let data = JSON.parse(cachedData);
      // await new Promise((res) => {
      //   setTimeout(() => {
      //     res("hi");
      //   }, 500);
      // });

      return NextResponse.json({ ...data }, { status: 200 });
    }

    const db = await connectDB(req);
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 3000);
    // });

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Find products where categoryPath contains the specified category ID
    const products = await db
      .collection("products")
      .find({ categoryPath: new ObjectId(categoryId) })
      .skip(skip)
      .limit(limit)
      .toArray();
    const filteredProducts = products.filter(
      (product) => product?.discountedPrice !== 0
    );
    // await new Promise((res) => {
    //   setTimeout(() => {
    //     res("hi");
    //   }, 3000);
    // });
    // Get the total count of documents for the category (for calculating total pages)
    const totalProducts = await db.collection("products").countDocuments({
      categoryPath: new ObjectId(categoryId),
      discountedPrice: { $ne: 0 },
    });

    const totalPages = Math.ceil(totalProducts / limit);

    const responseData = {
      products: filteredProducts,
      totalProducts,
      totalPages,
      currentPage: page,
      categoryId,
    };

    // await redisClient.set(cacheKey, JSON.stringify(responseData), {
    //   EX: 3600, // 3600 seconds = 1 hour
    // });

    try{
      await redis.set(cacheKey, JSON.stringify(responseData), {
        EX: 3600, // 3600 seconds = 1 hour
      });
    }catch(error){
      console.log("error", error);
    }

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// Helper function to generate a random price
const getRandomPrice = (min, max) => {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
};

export async function PUT(req, res) {
  if (req.method !== "PUT") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    // Verify token (example function, replace with your authentication logic)
    const tokenVerificationResponse = await isTokenVerified(req);
    if (tokenVerificationResponse) {
      return tokenVerificationResponse;
    }

    const db = await connectDB(req);

    // Define the range for random price and discounted price
    const priceMin = 10;
    const priceMax = 1000;
    const discountedPriceMin = 5;
    const discountedPriceMax = 500;

    // Update all products with random price and discountedPrice, and ensure image is an array
    const result = await db.collection("products").updateMany(
      {},
      {
        $set: {
          price: getRandomPrice(priceMin, priceMax),
          discountedPrice: getRandomPrice(
            discountedPriceMin,
            discountedPriceMax
          ),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: "No products were updated" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "Products updated successfully",
        modifiedCount: result.modifiedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// export async function PATCH(req, res) {
//   if (req.method !== "PATCH") {
//     return NextResponse.json(
//       { message: "Method not allowed" },
//       { status: 405 }
//     );
//   }

//   try {
//     const { categoryId } = await req.json();

//     if (!categoryId) {
//       return NextResponse.json(
//         { message: "Missing category ID" },
//         { status: 400 }
//       );
//     }

//     const tokenVerificationResponse = await isTokenVerified(req);
//     if (tokenVerificationResponse) {
//       return tokenVerificationResponse;
//     }

//     const db = await connectDB(req);
   
//     const categories = await db.collection("categories").find({}).toArray();
//     let name = await findCategoryNameById(categories,categoryId)

  


//     const jioMartResponse = await fetch(
//       "https://3yp0hp3wsh-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.5.1)%3B%20Browser%3B%20instantsearch.js%20(4.59.0)%3B%20JS%20Helper%20(3.15.0)",
//       {
//         method: "POST",
//         headers: {
//           "Accept": "*/*",
//           "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
//           "Connection": "keep-alive",
//           "Origin": "https://www.jiomart.com",
//           "Referer": "https://www.jiomart.com/",
//           "Sec-Fetch-Dest": "empty",
//           "Sec-Fetch-Mode": "cors",
//           "Sec-Fetch-Site": "cross-site",
//           "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
//           "content-type": "application/x-www-form-urlencoded",
//           "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
//           "sec-ch-ua-mobile": "?0",
//           "sec-ch-ua-platform": '"macOS"',
//           "x-algolia-api-key": "aace3f18430a49e185d2c1111602e4b1",
//           "x-algolia-application-id": "3YP0HP3WSH"
//         },
//         body: JSON.stringify({
//           requests: [
//             {
//               indexName: "prod_mart_master_vertical_products_popularity",
//               params: "attributesToHighlight=%5B%5D&attributesToRetrieve=%5B%22*%22%2C%22-algolia_facet%22%2C%22-alt_class_keywords%22%2C%22-available_stores%22%2C%22-avg_discount%22%2C%22-avg_discount_pct%22%2C%22-avg_discount_rate%22%2C%22-avg_mrp%22%2C%22-avg_selling_price%22%2C%22-search_keywords%22%5D&clickAnalytics=true&distinct=false&enableRules=true&facetFilters=%5B%5B%22category_level.level4%3ADips%2C%20Dressings%2C%20Chilli%20%26%20Soya%20Sauce%22%5D%5D&facets=%5B%22algolia_facet.*%22%2C%22avg_discount_pct%22%2C%22avg_selling_price%22%2C%22brand%22%2C%22category_level.level4%22%5D&filters=category_ids%3A29008%20AND%20(mart_availability%3AJIO%20OR%20mart_availability%3AJIO_WA)%20AND%20(available_stores%3AFRGW%20OR%20available_stores%3APANINDIAGROCERIES)%20AND%20((inventory_stores%3AALL%20OR%20inventory_stores%3AU3HM%20OR%20inventory_stores_3p%3AALL%20OR%20inventory_stores_3p%3Agroceries_zone_non-essential_services%20OR%20inventory_stores_3p%3Ageneral_zone%20OR%20inventory_stores_3p%3Agroceries_zone_essential_services))&highlightPostTag=__%2Fais-highlight__&highlightPreTag=__ais-highlight__&hitsPerPage=12&maxValuesPerFacet=50&page=0&query=&ruleContexts=%5B%22PLP%22%5D&tagFilters="
//             },
//             {
//               indexName: "prod_mart_master_vertical_products_popularity",
//               params: "analytics=false&attributesToHighlight=%5B%5D&attributesToRetrieve=%5B%22*%22%2C%22-algolia_facet%22%2C%22-alt_class_keywords%22%2C%22-available_stores%22%2C%22-avg_discount%22%2C%22-avg_discount_pct%22%2C%22-avg_discount_rate%22%2C%22-avg_mrp%22%2C%22-avg_selling_price%22%2C%22-search_keywords%22%5D&clickAnalytics=false&distinct=false&enableRules=true&facets=category_level.level4&filters=category_ids%3A29008%20AND%20(mart_availability%3AJIO%20OR%20mart_availability%3AJIO_WA)%20AND%20(available_stores%3AFRGW%20OR%20available_stores%3APANINDIAGROCERIES)%20AND%20((inventory_stores%3AALL%20OR%20inventory_stores%3AU3HM%20OR%20inventory_stores_3p%3AALL%20OR%20inventory_stores_3p%3Agroceries_zone_non-essential_services%20OR%20inventory_stores_3p%3Ageneral_zone%20OR%20inventory_stores_3p%3Agroceries_zone_essential_services))&highlightPostTag=__%2Fais-highlight__&highlightPreTag=__ais-highlight__&hitsPerPage=0&maxValuesPerFacet=50&page=0&query=&ruleContexts=%5B%22PLP%22%5D"
//             }
//           ]
//         })
//       }
//     );

//     const jioMartData = await jioMartResponse.json();
//     const products = jioMartData.results[0].hits;
//     const categoryPath = await getCategoryPath(db, categoryId);
//     const transformedProducts = products
//       .filter(product => product.is_sodexo_eligible)
//       .map(product => {
//         const sellerData = product.seller_wise_mrp?.[6205];
//         if (!sellerData) return null;
        
//         const firstKey = Object.keys(sellerData)[0];
//         const priceDetails = sellerData[firstKey];
        
//         if (!priceDetails) return null;
//         const imageUrl = product.image_url.replace(
//           /images\/product\/\d+x\d+\//,
//           'images/product/original/'
//         ) + '?im=Resize=(360,360)';
//         console.log("imageUrl",imageUrl)
//         return {
//           name: product.display_name,
//           categoryPath: categoryPath.map(id => new ObjectId(id)),
//           image: `https://www.jiomart.com/${imageUrl}`,
//           discountedPrice: Math.round(priceDetails.price),
//           price: Math.round(priceDetails.mrp),
//           size: product.size,
//         };
//       })
//       .filter(Boolean);

//     if (transformedProducts.length === 0) {
//       return NextResponse.json(
//         { message: "No eligible products found" },
//         { status: 404 }
//       );
//     }

//     await db.collection("products").deleteMany({
//       categoryPath: { 
//         $all: categoryPath.map(id => new ObjectId(id))
//       }
//     });

//     const productsToInsert = transformedProducts.map(product => ({
//       ...product,
//       _id: new ObjectId()
//     }));

//     const additionalSugarProduct = {
//       name: "UTTAM SUGAR Sulphurfree Sugar (Refined Safed Cheeni)",
//       categoryPath: categoryPath.map(id => new ObjectId(id)),
//       image: "https://rukminim2.flixcart.com/image/832/832/xif0q/sugar/i/a/q/-original-imagtxubkgmbwpa6.jpeg?q=70",
//       discountedPrice: 0,
//       price: 65,
//       size: "1 kg",
//       _id: new ObjectId("676da9f75763ded56d43032d"),
//     };
//     if (categoryId === "676da298e48e180ad5a91182") {
//     productsToInsert.push(additionalSugarProduct);
//     }
// console.log("productsToInsert",productsToInsert)
//     const result = await db.collection("products").insertMany(productsToInsert);

//     return NextResponse.json(
//       {
//         message: "Products synced successfully",
//         count: {
//           inserted: result.insertedCount,
//         }
//       },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("Error:", error);
//     return NextResponse.json(
//       { error: "Something went wrong" },
//       { status: 500 }
//     );
//   }
// }






export async function PATCH(req, res) {
  if (req.method !== "PATCH") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { categories } = await req.json();
    const db = await connectDB(req);
    const results = [];

    for (const categoryName of categories) {
      try {
        const config = categoryConfig[categoryName];
        if (!config) {
          throw new Error(`Invalid category name: ${categoryName}`);
        }

        // Convert params object to URL-encoded string
        const paramsString = new URLSearchParams({
          attributesToHighlight: '[]',
          attributesToRetrieve: '["*","-algolia_facet","-alt_class_keywords","-available_stores","-avg_discount","-avg_discount_pct","-avg_discount_rate","-avg_mrp","-avg_selling_price","-search_keywords"]',
          clickAnalytics: 'true',
          distinct: 'false',
          enableRules: 'true',
          facetFilters: `[["${config.facetFilters}"]]`,
          facets: '["algolia_facet.*","avg_discount_pct","avg_selling_price","brand","category_level.level4"]',
          filters: `category_ids:${config.categoryIds} AND (mart_availability:JIO OR mart_availability:JIO_WA) AND (available_stores:${config.availableStores}) AND ((inventory_stores:${config.inventoryStores} OR inventory_stores_3p:ALL OR inventory_stores_3p:groceries_zone_non-essential_services OR inventory_stores_3p:general_zone OR inventory_stores_3p:groceries_zone_essential_services))`,
          highlightPostTag: '__/ais-highlight__',
          highlightPreTag: '__ais-highlight__',
          hitsPerPage: '12',
          maxValuesPerFacet: '50',
          page: '0',
          query: '',
          ruleContexts: '["PLP"]',
          tagFilters: ''
        }).toString();

        const request = {
          indexName: "prod_mart_master_vertical_products_popularity",
          params: paramsString
        };

        const jioMartResponse = await fetch(
          "https://3yp0hp3wsh-dsn.algolia.net/1/indexes/*/queries",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "x-algolia-api-key": "aace3f18430a49e185d2c1111602e4b1",
              "x-algolia-application-id": "3YP0HP3WSH"
            },
            body: JSON.stringify({ requests: [request] })
          }
        );

        const jioMartData = await jioMartResponse.json();
        console.log("jioMartData",jioMartData)
       // return NextResponse.json(jioMartData, { status: 200 });
       // return NextResponse.json(jioMartData, { status: 200 });
        const products = jioMartData.results[0].hits;
        console.log("products",products)
      //  return NextResponse.json(products, { status: 200 });
        const categoryPath = await getCategoryPath(db, categoryName);
        console.log("iuytredfghjk",categoryPath)
       // return NextResponse.json(categoryPath, { status: 200 });
        // Transform products
        const transformedProducts = products
          .filter(product => product.is_sodexo_eligible)
          .map(product => {
            const sellerData = product.seller_wise_mrp?.[6205];
            if (!sellerData) return null;
            
            const firstKey = Object.keys(sellerData)[0];
            const priceDetails = sellerData[firstKey];
            
            if (!priceDetails) return null;
            
            const imageUrl = product.image_url.replace(
              /images\/product\/\d+x\d+\//,
              'images/product/original/'
            ) + '?im=Resize=(360,360)';

            return {
              name: product.display_name,
              categoryPath: categoryPath.map(id => new ObjectId(id)),
              image: `https://www.jiomart.com/${imageUrl}`,
              discountedPrice: Math.round(priceDetails.price),
              price: Math.round(priceDetails.mrp),
              size: product.size,
              category: categoryName
            };
          })
          .filter(Boolean);
          console.log("transformedProducts",transformedProducts)
          //return NextResponse.json(transformedProducts, { status: 200 });

        // Instead of deleting, we'll update existing products and add new ones
        for (const product of transformedProducts) {
          const existingProduct = await db.collection("products").findOne({
            name: product.name,
            categoryPath: { 
              $all: categoryPath.map(id => new ObjectId(id))
            }
          });

          if (existingProduct) {
            // Update existing product
            await db.collection("products").updateOne(
              { _id: existingProduct._id },
              { 
                $set: {
                  image: product.image,
                  discountedPrice: product.discountedPrice,
                  price: product.price,
                  size: product.size,
                  category: product.category,
                  lastUpdated: new Date()
                }
              }
            );
          } else {
            // Insert new product
            await db.collection("products").insertOne({
              ...product,
              _id: new ObjectId(),
              createdAt: new Date(),
              lastUpdated: new Date()
            });
          }
        }

        // Handle special case for Sugar category
        if (categoryName === 'Sugar') {
          const sugarProduct = {
            name: "UTTAM SUGAR Sulphurfree Sugar (Refined Safed Cheeni)",
            categoryPath: categoryPath.map(id => new ObjectId(id)),
            image: "https://rukminim2.flixcart.com/image/832/832/xif0q/sugar/i/a/q/-original-imagtxubkgmbwpa6.jpeg?q=70",
            discountedPrice: 0,
            price: 65,
            size: "1 kg",
            _id: new ObjectId("676da9f75763ded56d43032d"),
            category: 'Sugar',
            lastUpdated: new Date()
          };

          await db.collection("products").updateOne(
            { _id: sugarProduct._id },
            { $set: sugarProduct },
            { upsert: true }
          );
        }

        // Get counts for reporting
        const categoryProducts = await db.collection("products").find({
          categoryPath: { 
            $all: categoryPath.map(id => new ObjectId(id))
          }
        }).toArray();

        results.push({
          category: categoryName,
          totalProducts: categoryProducts.length
        });

        console.log(`Updated ${categoryName}: ${categoryProducts.length} products`);

      } catch (error) {
        console.error(`Error processing ${categoryName}:`, error);
        results.push({
          category: categoryName,
          error: error.message
        });
      }
    }

    return NextResponse.json(
      {
        message: "Categories sync completed",
        results: results
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Something went wrong", details: error.message },
      { status: 500 }
    );
  }
}


async function getCategoryPath(db, categoryName) {
  const findPath = async (categories, targetName, currentPath = []) => {
    for (const category of categories) {
      // Check if this is the target category by name
      if (category.name === targetName) {
        return [...currentPath, category._id?.toString()];
      }
      
      // If this category has children, recursively search them
      if (category.children && category.children.length > 0) {
        const path = await findPath(
          category.children,
          targetName,
          [...currentPath, category._id?.toString()]
        );
        if (path) return path;
      }
    }
    return null;
  };

  // Get the mapping of category names to their paths
  const categories = await db.collection("categories").find({}).toArray();
  
  // Find the path for the given category name
  const path = await findPath(categories, categoryName);
  
  if (!path) {
    throw new Error(`Category path not found for: ${categoryName}`);
  }

  return path;
}

// Helper function to get category path
// async function getCategoryPath(db, targetCategoryId) {
//   const findPath = async (categories, targetId, currentPath = []) => {
//     for (const category of categories) {
//       if (category._id.toString() === targetId) {
//         return [...currentPath, category._id];
//       }
      
//       if (category.children && category.children.length > 0) {
//         const path = await findPath(
//           category.children,
//           targetId,
//           [...currentPath, category._id]
//         );
//         if (path) return path;
//       }
//     }
//     return null;
//   };

//   const categories = await db.collection("categories").find({}).toArray();
//   return findPath(categories, targetCategoryId);
// }



const findCategoryNameById = async (categories, targetId) => {
  for (const category of categories) {
    if (category._id.toString() === targetId) {
      return category.name;
    }
    
    if (category.children && category.children.length > 0) {
      for (const child of category.children) {
        if (child._id.toString() === targetId) {
          return child.name;
        }
        
        if (child.children && child.children.length > 0) {
          for (const grandChild of child.children) {
            if (grandChild._id.toString() === targetId) {
              return grandChild.name;
            }
          }
        }
      }
    }
  }
  return null;
};
