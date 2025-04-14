StopWatch stopWatch = new StopWatch();
stopWatch.start("JDBC Query");
ResultSet rs = statement.executeQuery("SELECT * FROM my_table");
stopWatch.stop();

stopWatch.start("Data Mapping");
while (rs.next()) { /* mapping */ }
stopWatch.stop();

stopWatch.start("Logic");
processData(...);
stopWatch.stop();

System.out.println(stopWatch.prettyPrint());

1. Measure Databricks Query Execution Time
  Use a StopWatch or manually capture timestamps before and after executing the JDBC query.

  long queryStartTime = System.currentTimeMillis();

ResultSet resultSet = statement.executeQuery("SELECT * FROM my_table");

long queryEndTime = System.currentTimeMillis();
long queryExecutionTime = queryEndTime - queryStartTime;
System.out.println("Query Execution Time (ms): " + queryExecutionTime);


2. Measure Data Transfer Time from Databricks to Java

If the query returns a large dataset, data transfer time can be significant. You can measure the time it takes to fully read the result set:

  long dataTransferStartTime = System.currentTimeMillis();

List<MyData> dataList = new ArrayList<>();
while (resultSet.next()) {
    MyData data = new MyData();
    data.setField1(resultSet.getString("field1"));
    data.setField2(resultSet.getInt("field2"));
    // ... populate fields
    dataList.add(data);
}

long dataTransferEndTime = System.currentTimeMillis();
long dataTransferTime = dataTransferEndTime - dataTransferStartTime;
System.out.println("Data Transfer Time (ms): " + dataTransferTime);

. Measure Logical Business Logic/Calculation Time

After retrieving and mapping the data, if you do additional logic:

  long logicStartTime = System.currentTimeMillis();

// Sample logical processing
List<MyProcessedData> processedList = processData(dataList);

long logicEndTime = System.currentTimeMillis();
long logicTime = logicEndTime - logicStartTime;
System.out.println("Business Logic Processing Time (ms): " + logicTime);


 Full Example Inside a Spring Boot Service

   public List<MyProcessedData> getDataFromDatabricks() throws SQLException {
    long totalStart = System.currentTimeMillis();

    Connection connection = DriverManager.getConnection(DB_URL, USER, PASSWORD);
    Statement statement = connection.createStatement();

    long queryStart = System.currentTimeMillis();
    ResultSet resultSet = statement.executeQuery("SELECT * FROM my_table");
    long queryEnd = System.currentTimeMillis();
    System.out.println("Query Execution Time: " + (queryEnd - queryStart) + " ms");

    long transferStart = System.currentTimeMillis();
    List<MyData> dataList = new ArrayList<>();
    while (resultSet.next()) {
        MyData data = new MyData();
        // populate fields
        dataList.add(data);
    }
    long transferEnd = System.currentTimeMillis();
    System.out.println("Data Transfer Time: " + (transferEnd - transferStart) + " ms");

    long logicStart = System.currentTimeMillis();
    List<MyProcessedData> processedData = processData(dataList);
    long logicEnd = System.currentTimeMillis();
    System.out.println("Logical Processing Time: " + (logicEnd - logicStart) + " ms");

    long totalEnd = System.currentTimeMillis();
    System.out.println("Total End-to-End Time: " + (totalEnd - totalStart) + " ms");

    return processedData;
}
 Optional: Use Spring StopWatch for Clean Code


   StopWatch stopWatch = new StopWatch();
stopWatch.start("JDBC Query");
ResultSet rs = statement.executeQuery("SELECT * FROM my_table");
stopWatch.stop();

stopWatch.start("Data Mapping");
while (rs.next()) { /* mapping */ }
stopWatch.stop();

stopWatch.start("Logic");
processData(...);
stopWatch.stop();

System.out.println(stopWatch.prettyPrint());


  
