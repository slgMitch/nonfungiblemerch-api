const AWS = require('aws-sdk');
const eventbridge = new AWS.EventBridge();
const axios = require('axios');

exports.lambdaHandler = async (event) => {
    const { printfulRequests, selectedBaseProduct, selectedUserImages, selectedImagePlacement  } = event.detail
    for(let printfulRequest of printfulRequests) {
        const currentImage = printfulRequest.sync_variants[0].files[0].url
        const selectedUserImage = selectedUserImages.find(image => image.metadata.image === currentImage)
        try {
            const createStoreProductDBbbResponse = await createStoreProduct(printfulRequest)

            const data = {
                product: createStoreProductDBbbResponse,
                printfulRequest, 
                selectedBaseProduct, 
                selectedUserImage, 
                selectedImagePlacement
            }
    
            const params = {
                Entries: [{
                    Detail: JSON.stringify(data),
                    DetailType: "update-products",
                    Source: "ProductEndpoint",
                    EventBusName: process.env.EVENT_BUS_NAME
                  }]
            }
    
            await eventbridge.putEvents(params).promise()

            
        } catch (err) {
            console.log('there was an error', err)
            console.log(err.message)
        }
    }
    return {
        "success": true
    }
}

async function createStoreProduct(productDetails) {
    try {
        const { data } = await axios.post('https://api.printful.com/store/products', productDetails, {
            headers: {
                'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
                'content-type': 'application/json',
            },
        });
        return data;
    } catch(error) {
        console.log('there was an error in createStoreProduct', error)
        throw new Error(error)
    }
}