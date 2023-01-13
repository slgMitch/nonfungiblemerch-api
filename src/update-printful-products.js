
// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// //
// Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files (the "Software"), to deal in the Software
// without restriction, including without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so.
// //
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

const AWS = require('aws-sdk');
const eventbridge = new AWS.EventBridge();
const axios = require('axios');

exports.lambdaHandler = async (event) => {
    console.log('Were in the update lambda handler')
    
    try {
        const {
            product,
            printfulRequest, 
            selectedBaseProduct, 
            selectedUserImage, 
            selectedImagePlacement
        } = event.detail

        const { result: { id }  } = product
        const productWithPreviews = await getVariantPreviewImages(id)

        if(productWithPreviews) {
            const variantWithImage = productWithPreviews.sync_variants[0]
            const previewFileUrl = variantWithImage.files[1].preview_url
            printfulRequest.sync_product.thumbnail = previewFileUrl
            const updatedProductData = JSON.stringify(printfulRequest)
        
            await updateStoreProduct(id, updatedProductData)

            const eventData = {
                productWithPreviews,
                printfulRequest, 
                selectedBaseProduct, 
                selectedUserImage, 
                selectedImagePlacement
            }
    
            const params = {
                Entries: [{
                    Detail: JSON.stringify(eventData),
                    DetailType: "save-product",
                    Source: "ProductEndpoint",
                    EventBusName: process.env.EVENT_BUS_NAME
                  }]
            }
    
            const eventBridgeResult = await eventbridge.putEvents(params).promise()
      
            console.log('Pushed data to EventBridge', eventBridgeResult);  


        }
    } catch (err) {
        console.log(err.message)
    }
    return {
        "success": true
    }
}

async function getVariantPreviewImages(id) {
    try {
        let productWithPreviews, runLoop = true
    
        while(runLoop === true) {
            const getProductResponse = await getStoreProductById(id)
            if(getProductResponse.result) {
                const getProductSyncVariants = getProductResponse.result.sync_variants
                const variantsWithPreview = handleVariants(getProductSyncVariants)
                if(variantsWithPreview.length == getProductSyncVariants.length) {
                    const { result } = getProductResponse
                    productWithPreviews = result
                    runLoop = false
                }
            }
        }
        console.log('productWithPreviews', productWithPreviews)
        return productWithPreviews

    } catch(error) {
        return error
    }
}

async function getStoreProductById(productId) {
    try {
        const { data } = await axios.get(`https://api.printful.com/store/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`
            },
        });
        return data;
    } catch(error) {
        console.log('there was a prinful error', error)
        return error
    }
}

async function updateStoreProduct(productId, productDetails) {
    try {
        const { data } = await axios.put(`https://api.printful.com/store/products/${productId}`, productDetails, {
            headers: {
                'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
                'content-type': 'application/json',
            },
        });
        return data;
    } catch(error) {
        return error
    }
}

function handleVariants(variants) {
    let variantsWithPreview = []
    for(let variant of variants) {
        if(variant.files[1] && variant.files[1].type === 'preview' && variant.files[1].status === 'ok') {
            variantsWithPreview.push(variant)
        } 
    }
    return variantsWithPreview
}