import { isTokenVerified } from "@/json";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { connectDB } from "../../lib/dbconnection";
import RedisClient from "../../lib/redisClient";

export async function PATCH(req, res) {
  if (req.method !== "PATCH") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const { products } = await req.json();
    const db = await connectDB(req);
    const results = [];

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "Products array is required" },
        { status: 400 }
      );
    }

    console.log("Updating specific products:", products);

    // Get the specific products from database
    const productIds = products.map(id => new ObjectId(id));
    const existingProducts = await db.collection("products").find({
      _id: { $in: productIds }
    }).toArray();

    console.log("Found existing products:", existingProducts.length);

    // Update each product individually by searching JioMart
    for (const existingProduct of existingProducts) {
      try {
        console.log(`Searching for: ${existingProduct.name}`);
        
        // Search JioMart for this specific product
        const jioMartProduct = await searchJioMartProduct(existingProduct.name);
        
        if (jioMartProduct) {
            console.log("i765jioMartProduct66",jioMartProduct)
          // Update the product with fresh data
          await db.collection("products").updateOne(
            { _id: existingProduct._id },
            {
              $set: {
                image: jioMartProduct.image,
                discountedPrice: jioMartProduct.discountedPrice,
                price: jioMartProduct.price,
                size: jioMartProduct.size,
                maxQuantity: jioMartProduct.maxQuantity,
                lastUpdated: new Date(),
              },
            }
          );

          results.push({
            productId: existingProduct._id.toString(),
            status: "updated",
            name: existingProduct.name,
            oldPrice: existingProduct.price,
            newPrice: jioMartProduct.price,
            oldDiscountedPrice: existingProduct.discountedPrice,
            newDiscountedPrice: jioMartProduct.discountedPrice,
            oldMaxQuantity: existingProduct.maxQuantity,
            newMaxQuantity: jioMartProduct.maxQuantity,
          });

          console.log(`✅ Updated: ${existingProduct.name}`);
        } else {
          results.push({
            productId: existingProduct._id.toString(),
            status: "not_found_in_jioMart",
            name: existingProduct.name,
            error: "Product not found in JioMart"
          });

          console.log(`❌ Not found: ${existingProduct.name}`);
        }
      } catch (error) {
        console.error(`Error updating product ${existingProduct._id}:`, error);
        results.push({
          productId: existingProduct._id.toString(),
          status: "error",
          name: existingProduct.name,
          error: error.message
        });
      }
    }

    await RedisClient.flushAll();

    

    return NextResponse.json(
      {
        message: "Products sync completed",
        results: results,
        summary: {
          totalRequested: products.length,
          totalProcessed: results.length,
          updated: results.filter(r => r.status === "updated").length,
          notFound: results.filter(r => r.status === "not_found_in_jioMart").length,
          errors: results.filter(r => r.status === "error").length
        }
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

function getBuyboxMrp(data, productName, index = 0) {
    //console.log("876redfghjhfd",data)
    if (!data?.results?.[index]) return undefined;
  
    const product = data.results[index];
  
    // Case 1: Direct match with product title
    if (product?.product?.title === productName) {
      return product?.product?.attributes?.buybox_mrp?.text;
    }
  
    // Case 2: Try matching variant title (only if matchingVariantCount is present)
    if (product?.matchingVariantCount) {
      const variant = product?.product?.variants?.find(
        (item) => item?.title === productName
      );
      if (variant) {
        return variant?.attributes?.buybox_mrp?.text;
      }
    }
  
    // Recursive call to next index
    return getBuyboxMrp(data, productName, index + 1);
  }
// Helper function to search JioMart for a specific product
async function searchJioMartProduct(productName) {
  try {
    const response = await fetch('https://www.jiomart.com/lcat/rest/v1/vertex/search-products', {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'origin': 'https://www.jiomart.com',
        'referer': 'https://www.jiomart.com/',
      },
      body: JSON.stringify({
        "query": productName,
        "pageSize": 10, // Only get first 10 results
        "facetSpecs": [
          {"facetKey": {"key": "brands"}, "limit": 500, "excludedFilterKeys": ["brands"]},
          {"facetKey": {"key": "categories"}, "limit": 500, "excludedFilterKeys": ["categories"]},
          {"facetKey": {"key": "attributes.category_level_4"}, "limit": 500, "excludedFilterKeys": ["attributes.category_level_4"]},
          {"facetKey": {"key": "attributes.category_level_1"}, "excludedFilterKeys": ["attributes.category_level_4"]},
          {"facetKey": {"key": "attributes.avg_selling_price", "return_min_max": true, "intervals": [{"minimum": 0.1, "maximum": 100000000}]}},
          {"facetKey": {"key": "attributes.avg_discount_pct", "return_min_max": true, "intervals": [{"minimum": 0, "maximum": 99}]}}
        ],
        "filter": "attributes.status:ANY(\"active\") AND (attributes.available_regions:ANY(\"PANINDIABOOKS\", \"PANINDIACRAFT\", \"PANINDIADIGITAL\", \"PANINDIAFASHION\", \"PANINDIAFURNITURE\", \"U1P7\", \"PANINDIAGROCERIES\", \"PANINDIAHOMEANDKITCHEN\", \"PANINDIAHOMEIMPROVEMENT\", \"PANINDIAJEWEL\", \"PANINDIASTL\", \"PANINDIAWELLNESS\")) AND (attributes.inv_stores_1p:ANY(\"ALL\", \"U3HM\", \"SANR\", \"SANS\", \"SURR\", \"SANQ\", \"S4LI\", \"S535\", \"R975\", \"S402\", \"R300\", \"SLI1\", \"V017\", \"SB41\", \"TG1K\", \"SLE4\", \"SLTP\", \"T4QF\", \"S0XN\", \"SL7Q\", \"SZBL\", \"Y524\", \"SH09\", \"V027\", \"SJ14\", \"V012\", \"VLOR\", \"SF11\", \"SF40\", \"SX9A\", \"SC28\", \"SK1M\", \"R810\", \"SZ9U\", \"R696\", \"SJ93\", \"R396\", \"SE40\", \"S3TP\", \"SLOR\", \"SLKO\", \"R406\") OR attributes.inv_stores_3p:ANY(\"ALL\", \"groceries_zone_non-essential_services\", \"general_zone\", \"groceries_zone_essential_services\", \"fashion_zone\", \"electronics_zone\")) AND ( NOT attributes.vertical_code:ANY(\"ALCOHOL\"))",
        "canonical_filter": "attributes.status:ANY(\"active\") AND (attributes.available_regions:ANY(\"PANINDIABOOKS\", \"PANINDIACRAFT\", \"PANINDIADIGITAL\", \"PANINDIAFASHION\", \"PANINDIAFURNITURE\", \"U1P7\", \"PANINDIAGROCERIES\", \"PANINDIAHOMEANDKITCHEN\", \"PANINDIAHOMEIMPROVEMENT\", \"PANINDIAJEWEL\", \"PANINDIASTL\", \"PANINDIAWELLNESS\")) AND (attributes.inv_stores_1p:ANY(\"ALL\", \"U3HM\", \"SANR\", \"SANS\", \"SURR\", \"SANQ\", \"S4LI\", \"S535\", \"R975\", \"S402\", \"R300\", \"SLI1\", \"V017\", \"SB41\", \"TG1K\", \"SLE4\", \"SLTP\", \"T4QF\", \"S0XN\", \"SL7Q\", \"SZBL\", \"Y524\", \"SH09\", \"V027\", \"SJ14\", \"V012\", \"VLOR\", \"SF11\", \"SF40\", \"SX9A\", \"SC28\", \"SK1M\", \"R810\", \"SZ9U\", \"R696\", \"SJ93\", \"R396\", \"SE40\", \"S3TP\", \"SLOR\", \"SLKO\", \"R406\") OR attributes.inv_stores_3p:ANY(\"ALL\", \"groceries_zone_non-essential_services\", \"general_zone\", \"groceries_zone_essential_services\", \"fashion_zone\", \"electronics_zone\")) AND ( NOT attributes.vertical_code:ANY(\"ALCOHOL\"))",
        "visitor_id": "anonymous-0d21aadc-9e99-4ad9-96b5-07f4b11350a2"
      })
    });

    const data = await response.json();
    console.log("i765res6789dfghj",data)
    
    if (data?.results && data.results.length > 0) {
    //   let product = data.results[0];
    //   console.log("i765pr5678987654oduct",product?.product?.title,productName)
    //   if(product?.product?.title!==productName && !product?.matchingVariantCount ){
    //     product = data.results[1]
    //   }
    //   // we need to do this recursively
    //   let buyboxMrp = undefined
    //   if(product?.matchingVariantCount){
    //     buyboxMrp = product?.product?.variants?.find((item)=>item?.title===productName)?.attributes?.buybox_mrp?.text;
    //   }else{
    //      buyboxMrp = product?.product?.attributes?.buybox_mrp?.text;
    //   }

        let buyboxMrp = getBuyboxMrp(data, productName)
      
      
      // Parse the price data (format: "U1P7|1|Reliance Retail||213.0|167.0||46.0|21.0||2|")
      const priceData = buyboxMrp.find(item => item.includes('U1P7'));
      if (priceData) {
        const parts = priceData.split('|');
        const mrp = parseFloat(parts[4]); // MRP
        const sellingPrice = parseFloat(parts[5]); // Selling price
        const maxQuantity = parseInt(parts[parts.length - 2]) || 1
        console.log("i765maxQuantity",maxQuantity)
        
        return {
          name: product.product.title,
          image: product.product.images[0]?.uri || '',
          price: Math.round(mrp),
          discountedPrice: Math.round(sellingPrice),
          maxQuantity: maxQuantity
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching JioMart:', error);
    return null;
  }
}

// Helper function to extract size from product title
function extractSizeFromTitle(title) {
  const sizeMatch = title.match(/(\d+\s*(kg|g|ml|l|pack|pcs))/i);
  return sizeMatch ? sizeMatch[1] : '';
}