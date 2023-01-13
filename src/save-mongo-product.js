const AWS = require('aws-sdk');
const { MongoClient } = require('mongodb')
const eventbridge = new AWS.EventBridge();


exports.lambdaHandler = async (event) => {
    const client = await connectDatabase()

    const {
      productWithPreviews, 
      printfulRequest, 
      selectedBaseProduct, 
      selectedUserImage, 
      selectedImagePlacement
    } = event.detail


    const { product, productVariants } = generateMongoProductData(selectedBaseProduct, productWithPreviews, selectedUserImage) 
    await insertDocument(client, 'products', product)
    await insertDocuments(client, 'variants', productVariants)

    return {
      "message": "Great Success"
    }
}

function generateMongoProductData(selectedBaseProduct, productWithPreviews, selectedUserImage) {

  const { variants } = selectedBaseProduct
  const { sync_variants } = productWithPreviews

  const product = createProductData(sync_variants, productWithPreviews, selectedBaseProduct, selectedUserImage)
  const productVariants = craeteProductVariants(variants, sync_variants, selectedBaseProduct, selectedUserImage)

  const mongoProductData = {
    product,
    productVariants
  }

  return mongoProductData
}

function craeteProductVariants(variants, sync_variants, selectedBaseProduct, selectedUserImage) {
  const productVariants = sync_variants.map((sync) => {
    const variant = variants.find(v => v.id === sync.variant_id)
    const productVariant = {
      externalId: sync.external_id,
      syncVariantId: sync.id,
      baseVariantId: sync.variant_id,
      baseProductId: selectedBaseProduct.id,
      syncProductId: sync.sync_product_id,
      name: sync.name,
      imagePreviewUrl: sync.files[1].preview_url,
      imageThumbnailUrl: sync.files[1].thumbnail_url,
      color: { color: variant.color, color_code: variant.color_code },
      size: variant.size, 
      productCategory: selectedBaseProduct.category,
      tokenData: {
        tokenAddress: selectedUserImage.token_address,
        tokenName: selectedUserImage.metadata.name,
        tokenSymbol: selectedUserImage.symbol
      },
      retailPrice: sync.retail_price,
      productCreator: selectedUserImage.user,
      availabilityStatus: variant.availability_status
    }
    return productVariant
  })
  return productVariants
}


function createProductData(sync_variants, productWithPreviews, selectedBaseProduct, selectedUserImage) {
  const productMaxPrice = Math.max(...sync_variants.map(variant => variant.retail_price)).toFixed(2)
  const productMinPrice = Math.min(...sync_variants.map(variant => variant.retail_price)).toFixed(2)

  const product = {
    externalId: productWithPreviews.sync_product.external_id,
    baseProductId: selectedBaseProduct.id,
    syncProductId: productWithPreviews.sync_product.id,
    name: productWithPreviews.sync_product.name,
    imagePreviewUrl: sync_variants[0].files[1].preview_url,
    imageThumbnailUrl: sync_variants[0].files[1].thumbnail_url,
    colors: selectedBaseProduct.colors,
    sizes: selectedBaseProduct.sizes,
    productCategory: selectedBaseProduct.category,
    tokenData: {
      tokenAddress: selectedUserImage.token_address,
      tokenName: selectedUserImage.metadata.name,
      tokenSymbol: selectedUserImage.symbol
    },
    maxPrice: productMaxPrice,
    minPrice: productMinPrice,
    productCreator: selectedUserImage.user
  }

  return product
}


async function connectDatabase() {
    const client = await MongoClient.connect(process.env.MONGO_URL);
  
    return client;
}

async function insertDocument(client, collection, document) {
    const db = client.db();
  
    const result = await db.collection(collection).insertOne(document);
  
    return result;
}

async function insertDocuments(client, collection, documents) {
    const db = client.db();
  
    const result = await db.collection(collection).insertMany(documents);
  
    return result;
}  