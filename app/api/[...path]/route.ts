import { NextRequest, NextResponse } from 'next/server';

// Import the Express app
const expressApp = require('@/server');

// Helper to convert Next.js request to Express-compatible format
async function handleExpressRequest(request: NextRequest, method: string) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Parse body if present
    let body = null;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const text = await request.text();
        body = text ? JSON.parse(text) : null;
      } catch (e) {
        body = null;
      }
    }

    // Create Express-compatible request
    const expressReq: any = {
      method,
      url: path + url.search,
      path,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      query: Object.fromEntries(url.searchParams.entries()),
    };

    // Create response container
    const responseData = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: '',
    };

    // Create Express-compatible response
    const expressRes: any = {
      status(code: number) {
        responseData.statusCode = code;
        return this;
      },
      json(data: any) {
        responseData.body = JSON.stringify(data);
        responseData.headers['content-type'] = 'application/json';
        return this;
      },
      send(data: any) {
        responseData.body = typeof data === 'string' ? data : JSON.stringify(data);
        if (!responseData.headers['content-type']) {
          responseData.headers['content-type'] = typeof data === 'string' ? 'text/plain' : 'application/json';
        }
        return this;
      },
      setHeader(key: string, value: string) {
        responseData.headers[key.toLowerCase()] = value;
        return this;
      },
      set(key: string, value: string) {
        responseData.headers[key.toLowerCase()] = value;
        return this;
      },
      end(data?: any) {
        if (data) {
          responseData.body = typeof data === 'string' ? data : JSON.stringify(data);
        }
        return this;
      },
    };

    // Handle the request with Express app
    await new Promise<void>((resolve, reject) => {
      try {
        expressApp(expressReq, expressRes, (err?: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
        // If response methods were called synchronously, resolve immediately
        if (responseData.body || responseData.statusCode !== 200) {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });

    // Return Next.js response
    return new NextResponse(responseData.body, {
      status: responseData.statusCode,
      headers: responseData.headers,
    });
  } catch (error: any) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleExpressRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleExpressRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return handleExpressRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return handleExpressRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return handleExpressRequest(request, 'PATCH');
}

