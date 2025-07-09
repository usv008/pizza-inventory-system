require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSchemaFixed() {
  console.log('🔧 Testing FIXED Supabase schema...\n');
  
  try {
    // Test 1: Try to insert a stock movement with corrected fields
    console.log('📝 Test 1: Inserting stock movement with corrected fields...');
    const { data: insertData, error: insertError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: 1,
        movement_type: 'IN',
        quantity: 10,
        pieces: 50,
        boxes: 5,
        created_by: 'migration_test',
        reason: 'Schema fix test'
      })
      .select()
      .single();
    
    if (insertError) {
      console.log('❌ Insert failed:', insertError.message);
      if (insertError.message.includes('row-level security')) {
        console.log('🔒 RLS still blocking - need to disable policies');
      }
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        console.log('📋 Still missing columns');
      }
    } else {
      console.log('✅ Insert successful! Record ID:', insertData.id);
      console.log('📋 Inserted data:', insertData);
    }
    
    // Test 2: Check if new fields exist
    console.log('\n🔍 Test 2: Checking new fields structure...');
    const { data: structureData, error: structureError } = await supabase
      .from('stock_movements')
      .select('id, pieces, boxes, created_by, product_id, movement_type, quantity')
      .limit(1);
    
    if (structureError) {
      console.log('❌ Structure check failed:', structureError.message);
      if (structureError.message.includes('column') && structureError.message.includes('does not exist')) {
        console.log('🚨 Some fields still missing');
      }
    } else {
      console.log('✅ All fields accessible!');
      if (structureData.length > 0) {
        console.log('📋 Available fields:', Object.keys(structureData[0]));
      }
    }
    
    // Test 3: Try basic MovementService operations
    console.log('\n📖 Test 3: Reading all stock movements...');
    const { data: allData, error: allError } = await supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.log('❌ Read failed:', allError.message);
    } else {
      console.log('✅ Read successful! Total records:', allData.length);
      if (allData.length > 0) {
        console.log('📋 Sample record:', allData[0]);
      }
    }
    
    console.log('\n🎯 Schema fix verification completed!');
    
  } catch (error) {
    console.log('❌ Test failed with error:', error.message);
  }
}

testSchemaFixed().catch(console.error);
